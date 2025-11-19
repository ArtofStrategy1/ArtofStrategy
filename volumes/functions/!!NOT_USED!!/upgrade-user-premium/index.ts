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
   
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    // Upgrade specific user to premium
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      'b029ff2c-a078-474d-8988-f7f54c64ea47',
      {
        user_metadata: {
          first_name: 'Elijah',
          last_name: 'Furlonge',
          full_name: 'Elijah Furlonge',
          role: 'premium',  // Update this
          tier: 'premium'   // Update this
        },
        app_metadata: {
          role: 'premium',    // Update this
          tier: 'premium',    // Update this
          provider: 'email',
          providers: ['email']
        }
      }
    )

    if (updateError) {
      throw updateError
    }

    // Also update publicv2.users table
    const { error: dbError } = await supabase
      .from('users')
      .update({ 
        tier: 'premium',
        upgraded_at: new Date().toISOString()
      })
      .eq('email', 'elijahfurlonge@gmail.com')

    if (dbError) {
      console.error('Database update error:', dbError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User upgraded to premium',
      auth_updated: !updateError,
      db_updated: !dbError
    }), { headers })

  } catch (error) {
    console.error('Upgrade error:', error)
    return new Response(JSON.stringify({
      error: 'Upgrade failed',
      details: error.message
    }), {
      status: 500,
      headers
    })
  }
})