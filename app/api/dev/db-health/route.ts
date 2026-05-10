import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service";

/**
 * Quick Supabase connectivity + table-existence check.
 * GET /api/dev/db-health
 * Returns JSON with ok:true if incidents/call_sessions tables exist, or an error message.
 */
export const GET = async (): Promise<NextResponse> => {
  const client = getServiceRoleClient();
  if (!client) {
    return NextResponse.json({
      ok: false,
      mode: "in-memory",
      error: "No SUPABASE_SERVICE_ROLE_KEY — using in-memory demo store.",
    });
  }

  const results: Record<string, string> = {};

  for (const table of ["incidents", "call_sessions", "transcript_events", "audit_logs"] as const) {
    const { error } = await client.from(table).select("id").limit(1);
    if (error) {
      results[table] = `❌ ${error.message}`;
    } else {
      results[table] = "✅ accessible";
    }
  }

  const allOk = Object.values(results).every((v) => v.startsWith("✅"));

  return NextResponse.json({
    ok: allOk,
    mode: "supabase",
    tables: results,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    message: allOk
      ? "All tables reachable — Supabase persistence active."
      : "One or more tables missing. Run your migration SQL in the Supabase dashboard → SQL Editor.",
  });
};
