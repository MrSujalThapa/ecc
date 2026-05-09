import { NextResponse } from "next/server";
import { usesSupabasePersistence } from "@/lib/supabase/service";

/**
 * Whether API routes will persist to Supabase (`SUPABASE_SERVICE_ROLE_KEY` set).
 * Safe for the browser — does not expose secrets.
 */
export const GET = (): NextResponse => {
  return NextResponse.json({ uses_supabase: usesSupabasePersistence() });
};
