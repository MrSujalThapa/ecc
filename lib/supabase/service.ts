import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * Server-only Supabase client using the service role key (bypasses RLS).
 * Use from Route Handlers / Server Actions — never import in client components.
 */
export const getServiceRoleClient = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (cached === undefined) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
};

export const usesSupabasePersistence = (): boolean =>
  getServiceRoleClient() !== null;
