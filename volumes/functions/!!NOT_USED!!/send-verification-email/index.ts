// volumes/functions/send-verification-email/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";

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
    if (!body.email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers });
    }

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: Deno.env.get("SMTP_USER"),
      password: Deno.env.get("SMTP_PASS"),
    });

    await client.send({
      from: Deno.env.get("SMTP_ADMIN_EMAIL"),
      to: body.email,
      subject: "Verify your account",
      content: `Hello, please verify your account by clicking the link: ${body.verificationLink}`
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, message: "Email sent" }), { headers });

  } catch (err) {
    console.error("Email send error:", err);
    return new Response(JSON.stringify({ error: "Email send failed", details: err.message }), { status: 500, headers });
  }
});
