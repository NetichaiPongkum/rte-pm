// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ==========================================
// ⚠️ CONFIGURATION - อัพเดต URL และ Key ของคุณที่นี่
// ==========================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // เช่น https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Public anon key

// สร้าง Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose to global scope for non-module scripts
window.supabaseClient = supabase;
window.supabaseReady = true;

console.log('[Supabase] Client initialized');
