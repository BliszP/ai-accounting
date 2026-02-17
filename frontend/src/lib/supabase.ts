/**
 * Supabase Client (Frontend)
 *
 * Used for direct database access and file storage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables not set');
}

/**
 * Supabase client for frontend use
 * Note: This uses the anon key and respects RLS policies
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Storage helpers
 */
export const storage = {
  /**
   * Upload file to Supabase Storage
   */
  uploadFile: async (bucket: string, path: string, file: File) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Get public URL for file
   */
  getPublicUrl: (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Delete file
   */
  deleteFile: async (bucket: string, path: string) => {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      throw error;
    }
  },

  /**
   * List files in directory
   */
  listFiles: async (bucket: string, path: string = '') => {
    const { data, error } = await supabase.storage.from(bucket).list(path);

    if (error) {
      throw error;
    }

    return data;
  },
};

export default supabase;
