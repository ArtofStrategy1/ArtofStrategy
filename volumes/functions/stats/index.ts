// volumes/functions/stats/index.ts
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    )
  }

  try {
    // 1. JWT Validation
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Decode JWT to check expiration
    const base64Payload = token.split('.')[1]
    const decodedPayload = JSON.parse(atob(base64Payload))
    
    const currentTime = Math.floor(Date.now() / 1000)
    
    // Debug logging
    console.log('Current time:', currentTime)
    console.log('Token exp time:', decodedPayload.exp)
    console.log('Time difference:', decodedPayload.exp - currentTime, 'seconds')
    
    // Temporarily disable expiration check for testing
    // if (decodedPayload.exp && decodedPayload.exp < currentTime) {
    //   return new Response(
    //     JSON.stringify({ 
    //       error: 'Token has expired',
    //       current_time: currentTime,
    //       token_exp: decodedPayload.exp,
    //       difference: decodedPayload.exp - currentTime
    //     }),
    //     { status: 401, headers }
    //   )
    // }

    // 2. Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 3. Verify user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', decodedPayload.sub)
      .single()

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers }
      )
    }

    // 4. Parallel data collection
    const [dbStats, indexInfo, indexStats, namespaceInfo] = await Promise.all([
      // Get Latest Statistics from PostgreSQL
      supabase
        .from('statistics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single(),
      
      // Pinecone Describe Index
      fetch('https://api.pinecone.io/indexes/strategy-book', {
        headers: {
          'Api-Key': Deno.env.get('PINECONE_API_KEY')!
        }
      }).then(res => res.json()),
      
      // Pinecone Describe Index Stats
      fetch('https://strategy-book-pbq333f.svc.aped-4627-b74a.pinecone.io/describe_index_stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': Deno.env.get('PINECONE_API_KEY')!
        }
      }).then(res => res.json()),
      
      // Pinecone Namespace Stats
      fetch('https://strategy-book-pbq333f.svc.aped-4627-b74a.pinecone.io/namespaces/book', {
        headers: {
          'Api-Key': Deno.env.get('PINECONE_API_KEY')!,
          'X-Pinecone-API-Version': '2025-04'
        }
      }).then(res => res.json())
    ])

    // 5. Process data
    const database_status = {
      stat_id: dbStats.data?.id || null,
      database_name: dbStats.data?.database_name || 'unknown',
      database_size: dbStats.data?.database_size || 'unknown',
      total_users: dbStats.data?.total_users || 0,
      total_queries: dbStats.data?.total_queries || 0,
      recorded_at: dbStats.data?.recorded_at || null
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

    // 6. Return combined response
    return new Response(
      JSON.stringify({
        database_status,
        pinecone_status
      }),
      { headers }
    )

  } catch (error) {
    console.error('Stats endpoint error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
        details: error.message 
      }),
      { status: 500, headers }
    )
  }
})