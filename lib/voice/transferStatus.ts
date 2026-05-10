/**
 * lib/voice/transferStatus.ts
 *
 * Focused helper to update call_session.operator_transfer_status.
 * Used by transfer and dial-result routes so they can report
 * requested / transferred / failed without touching the full takeover flow.
 *
 * Works with both Supabase (production) and the in-memory demo store.
 * Server-side only.
 */

import { getServiceRoleClient } from "@/lib/supabase/service";
import { getCallSession, saveCallSession } from "@/lib/server/demo-store";
import type { OperatorTransferStatus } from "@/lib/types/enums";

export async function updateCallSessionTransferStatus(
  call_session_id: string,
  status: OperatorTransferStatus
): Promise<void> {
  const now = new Date().toISOString();
  const client = getServiceRoleClient();

  if (!client) {
    const session = getCallSession(call_session_id);
    if (!session) return;
    saveCallSession({ ...session, operator_transfer_status: status, updated_at: now });
    return;
  }

  await client
    .from("call_sessions")
    .update({ operator_transfer_status: status, updated_at: now })
    .eq("id", call_session_id);
}
