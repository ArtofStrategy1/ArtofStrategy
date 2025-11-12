// --- Supabase configuration ---
const SUPABASE_URL = "https://supabase.data2int.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU";
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
