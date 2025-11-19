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
      db: { schema: 'publicv2' } // Make sure this is your correct schema
    })

    // --- CORRECTED TARGET USER ---
    
    // 1. Set target User ID to 'supadatain@gmail.com'
    const TARGET_USER_ID = 'c196a3de-c012-4fe3-81c8-959f53fa0795'
    
    // 2. Set role to 'admin' in both metadata fields.
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      TARGET_USER_ID,
      {
        user_metadata: {
          role: 'admin' // Update this
        },
        app_metadata: {
          role: 'admin' // Update this
        }
      }
    )

    if (updateError) {
      throw updateError
    }

    // 3. Removed the database table update (as it's an auth role)

    return new Response(JSON.stringify({
      success: true,
      message: `User ${TARGET_USER_ID} upgraded to ADMIN`,
      auth_updated: !updateError,
    }), { headers })

  } catch (error) {
    console.error('Admin upgrade error:', error)
    return new Response(JSON.stringify({
      error: 'Admin upgrade failed',
      details: error.message
    }), {
      status: 500,
      headers
    })
  }
})

