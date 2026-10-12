import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** One signed-in device, as returned by the `my_sessions()` RPC. */
export type SessionRow = {
  readonly id: string;
  readonly created_at: string | null;
  readonly last_active_at: string | null;
  readonly user_agent: string | null;
  readonly ip: string | null;
};

/** The session id (`session_id` claim) of an access token; null when it cannot be read. */
export const sessionIdFromToken = (accessToken: string | null | undefined): string | null => {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
};

export const listMySessions = async (supabase: SupabaseClient): Promise<SessionRow[]> => {
  const { data, error } = await supabase.rpc("my_sessions");
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionRow[];
};

export const revokeMySession = async (supabase: SupabaseClient, sessionId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("revoke_my_session", { session_id: sessionId });
  if (error) throw new Error(error.message);
  return data === true;
};

/**
 * Mirror the display name onto the user's membership rows through the members schema's own `update_my_profile`
 * RPC (members_update RLS is manager-only, so a plain UPDATE would silently touch nothing for staff).
 * Best effort: the auth metadata is saved first and stays the fallback.
 */
export const syncMemberDisplayName = async (supabase: SupabaseClient, userId: string, displayName: string): Promise<void> => {
  const { data, error } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active");
  if (error) return console.warn("[account] members not read:", error.message);
  for (const row of (data ?? []) as Array<{ workspace_id: string }>) {
    const res = await supabase.rpc("update_my_profile", { ws: row.workspace_id, new_display_name: displayName });
    if (res.error) console.warn("[account] member display_name not synced:", res.error.message);
  }
};
