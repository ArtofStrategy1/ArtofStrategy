import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  // 1. Set up CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // TODO: Change to your production site origin
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' // Allow GET and PUT
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' } // Use publicv2 schema
    })

    // 3. SECURITY LAYER 1: JWT Verification
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - JWT token required'
      }), { status: 401, headers })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Invalid JWT token'
      }), { status: 401, headers })
    }

    // 4. SECURITY LAYER 2: Email Whitelist
    const ALLOWED_ADMIN_EMAILS = [
      'supadatain@gmail.com',
      'elijahfurlonge@yahoo.com',
      'gurby1@gmail.com',
      'gurby1@yahoo.com'
    ]
    
    if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
      return new Response(JSON.stringify({
        error: 'Access denied - Email not authorized'
      }), { status: 403, headers })
    }

    // 5. SECURITY LAYER 3: Database Admin Tier Check
    const { data: adminUser, error: adminCheckError } = await supabase
      .from('users')
      .select('tier')
      .eq('auth_user_id', user.id)
      .single()

    if (adminCheckError || !adminUser || adminUser.tier !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Access denied - Admin privileges required'
      }), { status: 403, headers })
    }

    // 6. Start Routing
    const url = new URL(req.url)
    const method = req.method
    const pathParts = url.pathname.split('/').filter(part => part)
    
    if (pathParts[0] === 'admin-feedback-secure') {
      pathParts.shift()
    }
    
    // --- ENDPOINT 1: GET /feedback ---
    // Securely fetches feedback with filters
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'feedback') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || ''
      const reason = url.searchParams.get('reason') || '' // Filter by 'reason'
      const sortBy = url.searchParams.get('sortBy') || 'created_at'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      const offset = (page - 1) * limit

      let query = supabase
        .from('feedback')
        .select(`
          *,
          users (
            first_name,
            last_name,
            email
          )
        `, { count: 'exact' }) // This join syntax works with Supabase JS

      if (search) {
        query = query.ilike('content', `%${search}%`)
      }
      if (status) {
        query = query.eq('status', status)
      }
      if (reason) {
        query = query.eq('reason', reason)
      }

      // Add multiple sort orders
      if (sortBy === 'priority') {
         query = query.order('priority', { ascending: sortOrder === 'asc', nullsFirst: false })
         query = query.order('created_at', { ascending: false })
      } else {
         query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      }
      
      query = query.range(offset, offset + limit - 1)

      const { data: feedback, error, count } = await query

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        message: 'Feedback retrieved successfully',
        data: feedback,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // --- ENDPOINT 2: PUT /feedback/:id ---
    // Securely updates status, priority, or admin_notes
    if (method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'feedback') {
      const feedbackId = pathParts[1]
      const body = await req.json()
      
      // Whitelist the fields that can be updated
      const allowedFields = ['status', 'priority', 'admin_notes']
      const updateData = {}
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({
          error: 'Invalid request. Must provide "status", "priority", or "admin_notes".'
        }), { status: 400, headers })
      }

      const { data: updatedFeedback, error } = await supabase
        .from('feedback')
        .update(updateData)
        .eq('id', feedbackId)
        .select()
        .single()
      
      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        message: 'Feedback item updated successfully',
        data: updatedFeedback,
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // 404 Fallback
    return new Response(JSON.stringify({
      error: 'Route not found',
      available_routes: [
        'GET /feedback - List feedback items',
        'PUT /feedback/:id - Update feedback item'
      ],
      authenticated_user: user.email,
      requested_path: url.pathname
    }), { status: 404, headers })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), { status: 500, headers })
  }
})