// ==========================================
// SUPABASE STORAGE HELPERS
// ==========================================

/**
 * Storage helper functions for Supabase Storage
 * ใช้สำหรับ Upload/Download/Delete ไฟล์
 */
const SupabaseStorage = {

    /** Default bucket name */
    defaultBucket: 'uploads',

    /**
     * Upload a file
     * @param {File} file 
     * @param {string} path - Optional custom path 
     * @param {string} bucket - Bucket name (default: 'uploads')
     * @returns {Promise<{path, publicUrl}>}
     */
    async upload(file, path = null, bucket = null) {
        const bucketName = bucket || this.defaultBucket;
        const filePath = path || `${Date.now()}_${file.name}`;

        const { data, error } = await window.supabaseClient.storage
            .from(bucketName)
            .upload(filePath, file);

        if (error) throw error;

        const { data: urlData } = window.supabaseClient.storage
            .from(bucketName)
            .getPublicUrl(data.path);

        return {
            path: data.path,
            publicUrl: urlData.publicUrl,
        };
    },

    /**
     * Get public URL for a file
     * @param {string} filePath 
     * @param {string} bucket 
     * @returns {string}
     */
    getPublicUrl(filePath, bucket = null) {
        const bucketName = bucket || this.defaultBucket;
        const { data } = window.supabaseClient.storage
            .from(bucketName)
            .getPublicUrl(filePath);
        return data.publicUrl;
    },

    /**
     * Delete a file
     * @param {string} filePath 
     * @param {string} bucket 
     */
    async remove(filePath, bucket = null) {
        const bucketName = bucket || this.defaultBucket;
        const { error } = await window.supabaseClient.storage
            .from(bucketName)
            .remove([filePath]);
        if (error) throw error;
    },

    /**
     * List files in a bucket path
     * @param {string} folderPath 
     * @param {string} bucket 
     * @returns {Promise<object[]>}
     */
    async list(folderPath = '', bucket = null) {
        const bucketName = bucket || this.defaultBucket;
        const { data, error } = await window.supabaseClient.storage
            .from(bucketName)
            .list(folderPath);
        if (error) throw error;
        return data || [];
    },

    /**
     * Download a file as blob
     * @param {string} filePath 
     * @param {string} bucket 
     * @returns {Promise<Blob>}
     */
    async download(filePath, bucket = null) {
        const bucketName = bucket || this.defaultBucket;
        const { data, error } = await window.supabaseClient.storage
            .from(bucketName)
            .download(filePath);
        if (error) throw error;
        return data;
    },
};

// Expose globally
window.SupabaseStorage = SupabaseStorage;
