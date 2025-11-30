/**
 * @name        statistics
 * @description Admin dashboard endpoint to aggregate system statistics.
 */
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  try {
    // 1. Validate JWT using your existing validate-jwt function
    const authHeader = req.headers.get('authorization')
    const requestBody = await req.json().catch(() => ({}))
    
    const validationResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-jwt-v2`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
        },
        body: JSON.stringify({
          headers: { authorization: authHeader },
          body: requestBody,
          method: 'POST'
        })
      }
    )

    const validationData = await validationResponse.json()

    if (validationData.shouldStop || !validationData.success) {
      return new Response(
        JSON.stringify(validationData),
        { status: validationData.status || 401, headers }
      )
    }

    console.log('User authenticated:', validationData.authenticated_user.email)

    // 2. Initialize Supabase client with publicv2 schema
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'publicv2' }
    })

    // 3. Check if update is requested
    const shouldUpdate = requestBody.update === true || requestBody.refresh === true

    // 4. If update requested, call the database function first
    if (shouldUpdate) {
      console.log('Updating statistics via database function...')
      const { data: updateResult, error: updateError } = await supabase.rpc('update_statistics')
      
      if (updateError) {
        console.error('Database function error:', updateError)
        throw updateError
      }
      if (updateResult && updateResult.error) {
        throw new Error(updateResult.error)
      }
      console.log('Statistics updated successfully')
    }

    // 5. Parallel data collection
    console.log("--- [DEBUG] Starting Parallel Fetch (DB + Pinecone) ---");
    
    let dbStats
    try {
      const result = await supabase
        .from('statistics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()
      
      if (result.error) {
        console.warn("--- [DEBUG] publicv2 fetch failed, trying fallback schema ---", result.error);
        // Fallback: try without schema specification if publicv2 fails
        const supabaseAlt = createClient(supabaseUrl, supabaseKey)
        const altResult = await supabaseAlt
          .from('statistics')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single()
        dbStats = altResult
      } else {
        dbStats = result
      }

      // --- ADDED DEBUGGING HERE ---
      console.log("--- [DEBUG] Raw DB Stats Result: ", JSON.stringify(dbStats));
      if (dbStats.data) {
          console.log("--- [DEBUG] Extracted avg_p_time: ", dbStats.data.avg_p_time);
          console.log("--- [DEBUG] Type of avg_p_time: ", typeof dbStats.data.avg_p_time);
      }
      // ----------------------------

    } catch (err) {
      console.error('Error fetching statistics:', err)
      dbStats = { data: null, error: err }
    }

    // Original Pinecone Logic (Hardcoded URLs and 3 calls as requested)
    const [indexInfo, indexStats, namespaceInfo] = await Promise.all([
      // Pinecone Describe Index
      fetch('https://api.pinecone.io/indexes/strategy-book', {
        headers: { 'Api-Key': Deno.env.get('PINECONE_API_KEY')! }
      }).then(res => res.json()),
      
      // Pinecone Describe Index Stats
      fetch('https://strategy-book-pbq333f.svc.aped-4627-b74a.pinecone.io/describe_index_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Key': Deno.env.get('PINECONE_API_KEY')! }
      }).then(res => res.json()),
      
      // Pinecone Namespace Stats
      fetch('https://strategy-book-pbq333f.svc.aped-4627-b74a.pinecone.io/namespaces/book', {
        headers: { 'Api-Key': Deno.env.get('PINECONE_API_KEY')!, 'X-Pinecone-API-Version': '2025-04' }
      }).then(res => res.json())
    ])

    // 6. Process data
    const database_status = {
      stat_id: dbStats.data?.id || null,
      database_name: 'postgres',
      database_size: dbStats.data?.database_size || 'unknown',
      total_users: dbStats.data?.total_users || 0,
      total_queries: dbStats.data?.total_queries || 0,
      log_in_users: dbStats.data?.log_in_users || 0,
      
      // --- CRITICAL: Passing raw value (String or Interval Object) to frontend ---
      avg_p_time: dbStats.data?.avg_p_time || null,
      
      recorded_at: dbStats.data?.recorded_at || null,
      updated: shouldUpdate
    }

    const pinecone_status = {
      name: indexInfo.name || 'unknown',
      metric: indexInfo.metric || 'unknown',
      dimension: indexInfo.dimension || 0,
      status: indexInfo.status?.state || 'unknown',
      ready: indexInfo.status?.ready || false,
      total_vectors: indexStats.totalVectorCount || 0,
      book_namespace_vectors: parseInt(namespaceInfo.record_count || 0),
      cloud_provider: indexInfo.spec?.serverless?.cloud || 'unknown',
      region: indexInfo.spec?.serverless?.region || 'unknown',
      generated_at: new Date().toISOString()
    }

    // 7. Return combined response
    return new Response(
      JSON.stringify({
        success: true,
        database_status,
        pinecone_status
      }),
      { headers }
    )

  } catch (error) {
    console.error('Statistics endpoint error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Server error', 
        details: error.message 
      }),
      { status: 500, headers }
    )
  }
})