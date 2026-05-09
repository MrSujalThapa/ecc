/**
 * Public Supabase credentials (browser + cookie-based server client).
 * Supports dashboard "publishable" key or legacy anon key name.
 */
export const getSupabaseUrl = (): string | undefined =>
  process.env.NEXT_PUBLIC_SUPABASE_URL;

export const getSupabaseAnonKey = (): string | undefined =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
