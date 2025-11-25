import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

/**
 * Helper function to create a new user in both auth.users and publicv2.users
 * This ensures data is synchronized.
 */
async function createNewUser(supabase: any, email: string, password: string, metadata: any) {
  // 1. Create the user in auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true, // Auto-confirm email for admin-created users
    user_metadata: {
      first_name: metadata.first_name,
      last_name: metadata.last_name,
      full_name: `${metadata.first_name} ${metadata.last_name}`,
      role: metadata.tier, // Set role in metadata
      tier: metadata.tier
    },
    app_metadata: {
      role: metadata.tier,
      tier: metadata.tier
    }
  })

  if (authError) {
    throw new Error(`Auth creation failed: ${authError.message}`)
  }

  // 2. Create the corresponding user in publicv2.users
  const { data: dbData, error: dbError } = await supabase
    .from('users')
    .insert([ // Must be an array
      {
        auth_user_id: authData.user.id, // Link to the auth user
        email: email,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
        tier: metadata.tier,
        upgraded_at: metadata.tier === 'premium' ? new Date().toISOString() : null
      }
    ])
    .select()

  if (dbError) {
    // If the DB insert fails, we must roll back the auth user - hard delete
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new Error(`DB insert failed: ${dbError.message}. Auth user creation was rolled back.`)
  }

  if (!dbData || dbData.length === 0) {
    // Handle case where insert succeeded but select returned nothing - hard delete
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new Error(`DB insert failed: No data returned after insert. Auth user creation was rolled back.`)
  }

  return dbData[0] // Return the first (and only) inserted record
}


serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Your production site origin
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' // Allow all methods
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    // SECURITY LAYER 1: JWT token verification
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

    // SECURITY LAYER 2: Email whitelist verification
    const ALLOWED_ADMIN_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    
    if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
      return new Response(JSON.stringify({
        error: 'Access denied - Email not authorized'
      }), { status: 403, headers })
    }

    // SECURITY LAYER 3: Database admin tier verification
    const { data: adminUser, error: adminCheckError } = await supabase
      .from('users')
      .select('tier, email')
      .eq('auth_user_id', user.id)
      .single()

    if (adminCheckError || !adminUser || adminUser.tier !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Access denied - Admin privileges required'
      }), { status: 403, headers })
    }

    // --- API ROUTING ---
    const url = new URL(req.url)
    const method = req.method
    const pathParts = url.pathname.split('/').filter(part => part)
    
    // DEBUG: Log every request
    console.log('=== REQUEST DEBUG ===')
    console.log('Method:', method)
    console.log('URL:', req.url)
    console.log('Path:', url.pathname)
    console.log('Path parts:', pathParts)
    console.log('=== END DEBUG ===')
    
    // Remove the function name from the path
    if (pathParts[0] === 'admin-users-secure') {
      pathParts.shift()
    }
    
    // GET /health - Health check
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'health') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Full Admin API - All Capabilities',
        authenticated_user: user.email,
        database_tier: adminUser.tier,
        security_layers: ['jwt_token', 'email_whitelist', 'database_tier'],
        capabilities: ['view_users', 'create_users', 'update_users', 'disable_users', 'delete_users', 'view_stats'],
        restrictions: ['no_non_admin_access', 'admin_users_protected_from_deletion'],
        timestamp: new Date().toISOString()
      }), { headers })
    }
    
    // GET /users/stats - User statistics
    if (method === 'GET' && pathParts.length === 2 && pathParts[0] === 'users' && pathParts[1] === 'stats') {
      const { data: stats, error } = await supabase
        .from('users')
        .select('tier, created_at')

      if (error) throw error

      const totalUsers = stats.length
      const premiumUsers = stats.filter(u => u.tier === 'premium').length
      const adminUsers = stats.filter(u => u.tier === 'admin').length
      const basicUsers = totalUsers - premiumUsers - adminUsers

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const newUsers = stats.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length

      return new Response(JSON.stringify({
        success: true,
        message: 'User statistics retrieved',
        data: {
          totalUsers, basicUsers, premiumUsers, adminUsers, newUsersLast30Days: newUsers,
          premiumPercentage: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0
        },
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // POST /users - Create a new user
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'users') {
      const body = await req.json()
      
      const { email, password, first_name, last_name, tier } = body

      if (!email || !password || !first_name || !last_name || !tier) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: email, password, first_name, last_name, tier'
        }), { status: 400, headers })
      }

      // Use the helper function to create the user in both tables
      const metadata = { first_name, last_name, tier }
      const newUser = await createNewUser(supabase, email, password, metadata)

      return new Response(JSON.stringify({
        success: true,
        message: 'User created successfully',
        data: newUser,
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { status: 201, headers })
    }

    // GET /users - List all users with pagination
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'users') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
      const search = url.searchParams.get('search') || ''
      const tier = url.searchParams.get('tier') || ''
      const sortBy = url.searchParams.get('sortBy') || 'created_at'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      const offset = (page - 1) * limit

      let query = supabase
        .from('users')
        .select('id, auth_user_id, created_at, first_name, last_name, tier, email, upgraded_at', { count: 'exact' })

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      if (tier && ['basic', 'premium', 'admin'].includes(tier)) {
        query = query.eq('tier', tier)
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      query = query.range(offset, offset + limit - 1)

      const { data: users, error, count } = await query

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
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

    // PUT /users/bulk-update - Bulk operations
    // *** MOVED UP for higher priority than /users/:id ***
    if (method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'users' && pathParts[1] === 'bulk-update') {
      const body = await req.json()
      const { action, userIds } = body

      if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(JSON.stringify({
          error: 'Invalid request. Requires action and a non-empty userIds array'
        }), { status: 400, headers })
      }

      let results = []
      const allowedActions = ['upgrade-to-premium', 'downgrade-to-basic', 'disable-users', 'delete-users']

      if (!allowedActions.includes(action)) {
        return new Response(JSON.stringify({
          error: 'Invalid action specified',
          allowed_actions: allowedActions
        }), { status: 400, headers })
      }

      // Get all target users to check for admins
      const { data: targetUsers, error: checkError } = await supabase
        .from('users')
        .select('id, auth_user_id, tier, email')
        .in('id', userIds)

      if (checkError) throw checkError

      // Filter out any admin users from the operation
      const adminUsers = targetUsers.filter(u => u.tier === 'admin')
      if (adminUsers.length > 0) {
        console.warn('Skipping bulk operation on admin users:', adminUsers.map(u => u.email))
      }
      
      const nonAdminUsers = targetUsers.filter(u => u.tier !== 'admin')
      const nonAdminIds = nonAdminUsers.map(u => u.id)

      if (nonAdminIds.length === 0) {
        return new Response(JSON.stringify({
          error: 'No valid (non-admin) users were selected for the operation.',
          note: 'Admin users are protected from bulk operations'
        }), { status: 400, headers })
      }

      switch (action) {
        case 'upgrade-to-premium':
          const { data: upgradedUsers, error: upgradeError } = await supabase
            .from('users')
            .update({ 
              tier: 'premium',
              upgraded_at: new Date().toISOString()
            })
            .in('id', nonAdminIds)
            .select('id, email, tier')
          if (upgradeError) throw upgradeError
          results = upgradedUsers
          break

        case 'downgrade-to-basic':
          const { data: downgradedUsers, error: downgradeError } = await supabase
            .from('users')
            .update({ tier: 'basic' })
            .in('id', nonAdminIds)
            .select('id, email, tier')
          if (downgradeError) throw downgradeError
          results = downgradedUsers
          break
        
        case 'disable-users':
          const disabledUsers = []
          const failedDisables = []

          // Loop through each non-admin user one by one
          for (const u of nonAdminUsers) {
            try {
              // 1. Update status to 'suspended' in publicv2.users
              const { data: updatedUser, error: updateStatusError } = await supabase
                .from('users')
                .update({ status: 'suspended' })
                .eq('id', u.id)
                .select('id, email, status')
                .single()

              if (updateStatusError) {
                throw new Error(`Failed to update status: ${updateStatusError.message}`)
              }

              if (!updatedUser) {
                throw new Error('Status update returned no data')
              }

              // 2. Disable in auth.users
              if (u.auth_user_id) {
                const { error: authDisableError } = await supabase.auth.admin.updateUserById(
                  u.auth_user_id,
                  { 
                    user_metadata: { 
                      disabled: true,
                      disabled_at: new Date().toISOString(),
                      disabled_by: user.email
                    } 
                  }
                )
                if (authDisableError) {
                  console.warn(`User ${u.id} status updated but auth disable failed: ${authDisableError.message}`)
                }
              }
              
              disabledUsers.push({ 
                id: updatedUser.id, 
                email: updatedUser.email, 
                status: updatedUser.status 
              })

            } catch (error) {
              console.error(`Failed to disable user ${u.id} (${u.email}): ${error.message}`)
              failedDisables.push({ id: u.id, email: u.email, error: error.message })
            }
          }
          
          results = disabledUsers

          return new Response(JSON.stringify({
            success: true,
            message: `Bulk disable completed. ${results.length} users disabled, ${failedDisables.length} failed.`,
            action,
            count: results.length,
            results,
            skipped_admins: adminUsers.map(u => u.email),
            failed_disables: failedDisables,
            authenticated_user: user.email,
            timestamp: new Date().toISOString()
          }), { headers })

        case 'delete-users':
          const deletedUsers = []
          const failedDeletes = []

          // Loop through each non-admin user one by one
          for (const u of nonAdminUsers) {
            try {
              // 1. Delete from publicv2.users
              const { error: deleteDbError } = await supabase
                .from('users')
                .delete()
                .eq('id', u.id)
              
              if (deleteDbError) {
                throw new Error(`DB delete failed: ${deleteDbError.message}`)
              }

              // 2. Delete from auth.users
              if (u.auth_user_id) {
                const { error: authDeleteError } = await supabase.auth.admin.deleteUser(u.auth_user_id)
                if (authDeleteError) {
                  console.warn(`DB user ${u.id} deleted, but auth delete failed: ${authDeleteError.message}`)
                }
              }
              
              deletedUsers.push({ id: u.id, email: u.email, tier: u.tier, status: 'permanently-deleted' })

            } catch (error) {
              console.error(`Failed to delete user ${u.id} (${u.email}): ${error.message}`)
              failedDeletes.push({ id: u.id, email: u.email, error: error.message })
            }
          }
          
          results = deletedUsers
          
          return new Response(JSON.stringify({
            success: true,
            message: `Bulk hard delete completed. ${results.length} users permanently deleted, ${failedDeletes.length} failed.`,
            action,
            count: results.length,
            results,
            skipped_admins: adminUsers.map(u => ({ email: u.email, reason: 'admin_protected' })),
            failed_deletes: failedDeletes,
            authenticated_user: user.email,
            note: 'Admin users were automatically skipped for security',
            timestamp: new Date().toISOString()
          }), { headers })
      }

      // This response is for 'upgrade' and 'downgrade'
      return new Response(JSON.stringify({
        success: true,
        message: `Bulk ${action} completed for ${results.length} non-admin users.`,
        action,
        count: results.length,
        results,
        skipped_admins: adminUsers.map(u => ({ email: u.email, reason: 'admin_protected' })),
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // PUT /users/:id/disable - Soft disable user account (MUST come before general PUT /users/:id)
    if (method === 'PUT' && pathParts.length === 3 && pathParts[0] === 'users' && pathParts[2] === 'disable') {
      const userId = pathParts[1]
      
      // Get user first to check if they're an admin
      const { data: targetUser, error: fetchError } = await supabase
        .from('users')
        .select('auth_user_id, email, tier')
        .eq('id', userId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers })
        }
        throw fetchError
      }

      if (targetUser.tier === 'admin') {
        return new Response(JSON.stringify({
          error: 'Cannot disable admin users'
        }), { status: 403, headers })
      }

      // 1. Update status to 'suspended'
      const { data: updatedUser, error: updateStatusError } = await supabase
        .from('users')
        .update({ status: 'suspended' })
        .eq('id', userId)
        .select('id, email, status')
        .single()

      if (updateStatusError) {
        return new Response(JSON.stringify({
          error: 'Failed to update user status in database',
          details: updateStatusError.message
        }), { status: 500, headers })
      }

      // 2. Disable the auth user (soft disable)
      if (targetUser.auth_user_id) {
        try {
          await supabase.auth.admin.updateUserById(
            targetUser.auth_user_id,
            { 
              user_metadata: { 
                disabled: true,
                disabled_at: new Date().toISOString(),
                disabled_by: user.email
              }
            }
          )
        } catch (authError) {
          return new Response(JSON.stringify({
            error: 'Failed to disable user account',
            details: authError.message
          }), { status: 500, headers })
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'User account disabled successfully',
        disabled_user: {
          id: userId,
          email: targetUser.email,
          status: updatedUser.status
        },
        action: 'soft_disable',
        reversible: true,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // GET /users/:id - Get specific user
    if (method === 'GET' && pathParts.length === 2 && pathParts[0] === 'users') {
      const userId = pathParts[1]
      
      const { data: targetUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers })
        }
        throw error
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'User retrieved successfully',
        data: targetUser,
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // PUT /users/:id - Update user
    if (method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'users') {
      const userId = pathParts[1]
      const body = await req.json()
      
      const allowedFields = ['first_name', 'last_name', 'email']
      const allowedTierChanges = ['basic', 'premium', 'admin']
      const updateData = {}
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      if (body.tier !== undefined) {
        if (!allowedTierChanges.includes(body.tier)) {
          return new Response(JSON.stringify({
            error: 'Invalid tier specified.',
            allowed_tiers: allowedTierChanges
          }), { status: 400, headers })
        }
        updateData.tier = body.tier
      }

      if (updateData.tier === 'premium') {
        updateData.upgraded_at = new Date().toISOString()
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      if ((updateData.tier || updateData.email) && updatedUser.auth_user_id) {
        try {
          const authUpdatePayload: any = {
            user_metadata: {
              ...updatedUser, 
              role: updateData.tier || updatedUser.tier,
              tier: updateData.tier || updatedUser.tier,
              full_name: `${updatedUser.first_name} ${updatedUser.last_name}`
            },
            app_metadata: {
              role: updateData.tier || updatedUser.tier,
              tier: updateData.tier || updatedUser.tier
            }
          }
          if (updateData.email) {
            authUpdatePayload.email = updateData.email
          }

          await supabase.auth.admin.updateUserById(
            updatedUser.auth_user_id,
            authUpdatePayload
          )
        } catch (authError) {
          console.error('Auth update error:', authError)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
        authenticated_user: user.email,
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // DELETE /users/:id - Hard delete
    if (method === 'DELETE' && pathParts.length === 2 && pathParts[0] === 'users') {
      const userId = pathParts[1]
      
      const { data: targetUser, error: fetchError } = await supabase
        .from('users')
        .select('auth_user_id, email, tier')
        .eq('id', userId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers })
        }
        throw fetchError
      }

      if (targetUser.tier === 'admin') {
        return new Response(JSON.stringify({ 
          error: 'Cannot delete admin users.' 
        }), { status: 403, headers })
      }

      const { data: deletedDbUsers, error: deleteDbError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .select('id, email, auth_user_id')
      
      if (deleteDbError) {
        throw new Error(`Failed to delete user from database: ${deleteDbError.message}`)
      }

      const deletedDbUser = (deletedDbUsers && deletedDbUsers.length > 0) ? deletedDbUsers[0] : null

      if (!deletedDbUser) {
        return new Response(JSON.stringify({ error: 'User not found for deletion.' }), { status: 404, headers })
      }

      if (deletedDbUser.auth_user_id) {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(deletedDbUser.auth_user_id)
        if (authDeleteError) {
          return new Response(JSON.stringify({
            error: 'User deleted from database but failed to delete from auth',
            details: authDeleteError.message
          }), { status: 500, headers })
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'User permanently deleted',
        deleted_user: { id: deletedDbUser.id },
        action: 'hard_delete',
        timestamp: new Date().toISOString()
      }), { headers })
    }

    // Fallback 404
    return new Response(JSON.stringify({
      error: 'Route not found',
      requested_path: url.pathname
    }), { status: 404, headers })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), { status: 500, headers })
  }
})