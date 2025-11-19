// volumes/functions/create-auth-user/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const body = await req.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://supabase.data2int.com";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false, // keep unconfirmed until email is sent
      user_metadata: body.metadata || {}
    });

    if (error) {
      console.error("Create user failed:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ success: true, user }), { headers });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ error: "Server error", details: err.message }), { status: 500, headers });
  }
});
