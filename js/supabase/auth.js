// ==========================================
// SUPABASE AUTH HELPERS
// ==========================================

/**
 * Authentication helper functions for Supabase
 * ใช้สำหรับจัดการ Login/Logout/Session
 */
const SupabaseAuth = {

    /**
     * Sign in with email and password
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{user, session, error}>}
     */
    async signInWithEmail(email, password) {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    /**
     * Sign in with username from custom users table
     * (สำหรับระบบ login แบบ username/password ที่ไม่ใช้ Supabase Auth)
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<object>}
     */
    async signInWithUsername(username, password) {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

        return data;
    },

    /**
     * Sign up new user with email
     * @param {string} email 
     * @param {string} password 
     * @param {object} metadata 
     * @returns {Promise<{user, session, error}>}
     */
    async signUp(email, password, metadata = {}) {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: { data: metadata },
        });
        if (error) throw error;
        return data;
    },

    /**
     * Sign out current user
     */
    async signOut() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
    },

    /**
     * Get current session
     * @returns {Promise<object|null>}
     */
    async getSession() {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;
        return session;
    },

    /**
     * Get current user
     * @returns {Promise<object|null>}
     */
    async getUser() {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        if (error) throw error;
        return user;
    },

    /**
     * Listen for auth state changes
     * @param {function} callback 
     * @returns {function} unsubscribe function
     */
    onAuthStateChange(callback) {
        const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange(
            (event, session) => callback(event, session)
        );
        return () => subscription.unsubscribe();
    },
};

// Expose globally
window.SupabaseAuth = SupabaseAuth;
