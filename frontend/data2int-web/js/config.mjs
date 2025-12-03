// --- Supabase configuration ---
const SUPABASE_URL = "https://supabase.sageaios.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0NTY1MjAwLCJleHAiOjE5MjIzMzE2MDB9.r9ggAn98eTtigs40WMQ4y3WGIjhvhXvFyxLyxfxwMi8";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'publicv2' }
});
const WEBSOCKET_URL = "wss://n8n-api.data2int.com/ws";
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

export const appConfig = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabase,
    WEBSOCKET_URL,
    maxReconnectAttempts,
    reconnectDelay
}
