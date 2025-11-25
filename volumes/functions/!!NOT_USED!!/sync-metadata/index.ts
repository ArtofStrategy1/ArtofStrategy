import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Service key not configured'
      }), { status: 500, headers })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    console.log('Fetching all users from publicv2.users...')
    
    // Get all users from publicv2.users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
    
    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      throw fetchError
    }

    console.log(`Found ${users.length} users to sync`)

    const results = []
    
    // Update each auth user's metadata
    for (const user of users) {
      if (!user.auth_user_id) {
        console.log(`Skipping user ${user.id} - no auth_user_id`)
        results.push({
          user_id: user.id,
          email: user.email,
          success: false,
          error: 'No auth_user_id'
        })
        continue
      }
      
      console.log(`Updating metadata for ${user.email} (${user.auth_user_id})`)
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.auth_user_id,
        {
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
          },
          app_metadata: {
            role: 'basic',
            tier: user.tier || 'basic',
            provider: 'email',
            providers: ['email']
          }
        }
      )
      
      if (updateError) {
        console.error(`Failed to update ${user.email}:`, updateError)
      } else {
        console.log(`Successfully updated ${user.email}`)
      }
      
      results.push({
        user_id: user.id,
        auth_user_id: user.auth_user_id,
        email: user.email,
        success: !updateError,
        error: updateError?.message || null
      })
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    console.log(`Sync complete: ${successCount} successful, ${failedCount} failed`)

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${successCount} users successfully`,
      updated: successCount,
      failed: failedCount,
      details: results
    }), { headers })

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(JSON.stringify({
      error: 'Sync failed',
      details: error.message
    }), {
      status: 500,
      headers
    })
  }
})