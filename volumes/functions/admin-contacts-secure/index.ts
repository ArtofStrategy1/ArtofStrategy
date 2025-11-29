/**
 * -----------------------------------------------------------------------------
 * @name        admin-contacts-secure
 * @description Admin-only endpoint to manage contact form submissions. 
 * Supports retrieving paginated/searchable lists and updating message status.
 * Enforces 3 layers of security (JWT, Email Allowlist, DB Admin Tier).
 * * @routes
 * 1. GET /contacts      - List messages with pagination, search, & filtering.
 * 2. PUT /contacts/:id  - Update the status of a specific message.
 * -----------------------------------------------------------------------------
 * @method      GET | PUT
 * @base_url    /functions/v1/admin-contacts-secure
 * -----------------------------------------------------------------------------
 * @params      (GET) ?page=1&limit=50&search=...&status=...&sortBy=...&sortOrder=...
 * @payload     (PUT) { status: 'New' | 'Replied' | 'Archived' }
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // TODO: Change to your production site origin
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' } // Assuming 'publicv2'
    })

    // --- All 4 Security Layers (Copied from your function) ---

    // 1. JWT token verification
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

    // 2. Email whitelist verification
    const ALLOWED_ADMIN_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    
    if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
      return new Response(JSON.stringify({
        error: 'Access denied - Email not authorized'
      }), { status: 403, headers })
    }

    // 3. Database admin tier verification (from 'users' table)
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
    
    // 4. Use Service Role Key for subsequent queries
    // (This is already done by initializing the client with supabaseServiceKey)

    // --- End Security Layers ---

    const url = new URL(req.url)
    const method = req.method
    const pathParts = url.pathname.split('/').filter(part => part)
    
    // Update path to look for this function's name
    if (pathParts[0] === 'admin-contacts-secure') {
      pathParts.shift()
    }
    
    // --- NEW ENDPOINT: GET /contacts ---
    // Fetches contact messages with search, filter, and pagination
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'contacts') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
      const search = url.searchParams.get('search') || ''
      const status = url.searchParams.get('status') || '' // New filter
      const sortBy = url.searchParams.get('sortBy') || 'created_at'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      const offset = (page - 1) * limit

      // Query the 'contacts' table (assumed name)
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })

      if (search) {
        // Search across multiple relevant fields
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`)
      }

      if (status) {
        query = query.eq('status', status)
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      query = query.range(offset, offset + limit - 1)

      const { data: contacts, error, count } = await query

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        message: 'Contacts retrieved successfully',
        data: contacts,
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

    // --- NEW ENDPOINT: PUT /contacts/:id ---
    // Updates the status of a contact message
    if (method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'contacts') {
      const contactId = pathParts[1]
      const body = await req.json()
      
      const allowedStatus = ['New', 'Replied', 'Archived']
      if (!body.status || !allowedStatus.includes(body.status)) {
        return new Response(JSON.stringify({
          error: 'Invalid request. "status" field is required and must be one of: ' + allowedStatus.join(', ')
        }), { status: 400, headers })
      }

      const { data: updatedContact, error } = await supabase
        .from('contacts')
        .update({ status: body.status })
        .eq('id', contactId)
        .select()
        .single()
      
      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        message: 'Contact status updated successfully',
        data: updatedContact,
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // Fallback 404
    return new Response(JSON.stringify({
      error: 'Route not found',
      available_routes: [
        'GET /contacts - List contacts with pagination/search/filter',
        'PUT /contacts/:id - Update contact status (e.g., {"status": "Replied"})'
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