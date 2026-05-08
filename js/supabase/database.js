// ==========================================
// SUPABASE DATABASE HELPERS
// ==========================================

/**
 * Database CRUD helper functions
 * ใช้สำหรับ Query, Insert, Update, Delete ข้อมูลจาก Supabase
 */
const SupabaseDB = {

    /**
     * Fetch all rows from a table
     * @param {string} table - Table name
     * @param {object} options - { columns, orderBy, ascending, limit, filters }
     */
    async getAll(table, options = {}) {
        let query = window.supabaseClient.from(table).select(options.columns || '*');

        // Apply filters
        if (options.filters) {
            for (const f of options.filters) {
                if (f.op === 'eq')  query = query.eq(f.field, f.value);
                if (f.op === 'neq') query = query.neq(f.field, f.value);
                if (f.op === 'gt')  query = query.gt(f.field, f.value);
                if (f.op === 'lt')  query = query.lt(f.field, f.value);
                if (f.op === 'gte') query = query.gte(f.field, f.value);
                if (f.op === 'lte') query = query.lte(f.field, f.value);
                if (f.op === 'in')  query = query.in(f.field, f.value);
                if (f.op === 'like') query = query.ilike(f.field, f.value);
            }
        }

        // Ordering
        if (options.orderBy) {
            query = query.order(options.orderBy, { ascending: options.ascending !== false });
        }

        // Limit
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch single row by ID
     * @param {string} table 
     * @param {string} id 
     */
    async getById(table, id) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Insert a new row
     * @param {string} table 
     * @param {object} row 
     * @returns {Promise<object>} inserted row
     */
    async insert(table, row) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .insert(row)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Bulk insert multiple rows
     * @param {string} table 
     * @param {object[]} rows 
     * @returns {Promise<object[]>}
     */
    async bulkInsert(table, rows) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .insert(rows)
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Update a row by ID
     * @param {string} table 
     * @param {string} id 
     * @param {object} updates 
     * @returns {Promise<object>}
     */
    async update(table, id, updates) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Upsert (insert or update)
     * @param {string} table 
     * @param {object} row 
     * @returns {Promise<object>}
     */
    async upsert(table, row) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .upsert(row)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Delete a row by ID
     * @param {string} table 
     * @param {string} id 
     */
    async remove(table, id) {
        const { error } = await window.supabaseClient
            .from(table)
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Subscribe to realtime changes on a table
     * @param {string} table 
     * @param {function} callback - receives (payload) with eventType, new, old
     * @returns {function} unsubscribe
     */
    subscribe(table, callback) {
        const channel = window.supabaseClient
            .channel(`realtime:${table}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table }, 
                (payload) => callback(payload)
            )
            .subscribe();

        return () => {
            window.supabaseClient.removeChannel(channel);
        };
    },
};

// Expose globally
window.SupabaseDB = SupabaseDB;
