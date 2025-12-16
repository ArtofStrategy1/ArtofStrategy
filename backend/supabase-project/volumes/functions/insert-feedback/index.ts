/**
 * -----------------------------------------------------------------------------
 * @name        insert-feedback
 * @description Securely handles feedback submission from an authenticated user.
 * It maps the incoming 'reason' field to a prioritized severity ('High', 
 * 'Medium', 'Low') before inserting the record into the 'feedback' table.
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/insert-feedback
 * -----------------------------------------------------------------------------
 * @security    Dual-Layer Authentication Required:
 * 1. Valid JWT Token (checks auth.users)
 * 2. Database Profile Lookup (matches auth_user_id to fetch integer user_profile_id)
 * -----------------------------------------------------------------------------
 * @payload     { 
 * reason: "Bug / Error" | "Suggestion / Improvement" | "Not Satisfied" | "Other",
 * content: string, // min 10 chars
 * tool_name?: string, 
 * rating?: number 
 * }
 * @logic       Maps 'reason' to a 'priority' field for database storage.
 * @returns     { success: true, message: "Feedback submitted successfully." }
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Define your priority mapping
const priorityMapping = {
  "Bug / Error": "High",
  "Suggestion / Improvement": "Medium",
  "Not Satisfied": "Medium",
  "Other": "Low"
}

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // 1. Initialize the Admin Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'publicv2' } } // Connect to your 'publicv2' schema
    )

    // 2. Get the user from their JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error("No authorization header provided.");
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError) {
      console.error("Auth Error:", authError.message);
      throw new Error("Invalid user token.");
    }
    if (!user) {
      throw new Error("User not found.");
    }

    // 3. Get the 'user_profile_id' (which is the 'id' from your 'users' table)
    // Your 'feedback' table requires this integer ID, not the auth.users.id
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id') // Select the integer 'id'
      .eq('auth_user_id', user.id) // Match it using the auth UUID
      .single()

    if (profileError || !userProfile) {
      console.error("Profile Error:", profileError?.message);
      throw new Error(`Could not find a user profile for auth_user_id: ${user.id}`);
    }
    const userProfileId = userProfile.id; // This is the integer ID we need

    // 4. Get the feedback data from the request
    const feedback = await req.json()
    const { tool_name, reason, content, rating } = feedback;

    if (!reason || !content || content.length < 10) {
      throw new Error("Invalid data: 'reason' and 'content' (min 10 chars) are required.");
    }

    // 5. --- THIS IS YOUR LOGIC ---
    // Map the 'reason' to the 'priority'
    // We use 'Medium' as a safe default if no match is found
    const priority = priorityMapping[reason] || 'Medium';

    // 6. Prepare the final object for insertion
    const feedbackData = {
      user_profile_id: userProfileId, // The integer ID from your 'users' table
      tool_name: tool_name,
      reason: reason,
      content: content,
      rating: rating,
      priority: priority, // Your new mapped priority
      status: 'Open' // Default status for new feedback
      // 'is_resolved' is no longer needed
    }

    // 7. Insert into the database
    const { error: insertError } = await supabase
      .from('feedback')
      .insert(feedbackData)

    if (insertError) {
      console.error("Insert Error:", insertError.message);
      throw new Error(`Failed to insert feedback: ${insertError.message}`);
    }

    // 8. Return a success response
    return new Response(JSON.stringify({ success: true, message: "Feedback submitted successfully." }), {
      headers,
      status: 200,
    })

  } catch (error) {
    console.error('Function error:', error.message)
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers,
      status: 400
    })
  }
})