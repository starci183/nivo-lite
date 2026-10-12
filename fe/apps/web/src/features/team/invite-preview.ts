import "server-only"
import { createHash } from "node:crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type InviteState = "pending" | "expired" | "revoked" | "accepted"

export type InvitePreview = {
  readonly workspaceName: string
  readonly email: string
  readonly role: "manager" | "staff"
  readonly staffName: string | null
  readonly inviterName: string | null
  readonly state: InviteState
}

type Row = {
  email: string
  role: "manager" | "staff"
  workspace_id: string
  invited_by: string | null
  staff_id: string | null
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
  workspaces: { name: string } | null
  staff: { name: string } | null
}

/**
 * What the holder of an invitation link may see before signing in: workspace, role, who invited them, and whether the link
 * still works. Looked up by the token's SHA-256 hash with the service role (the invite table is manager-only under RLS);
 * returns null for an unknown token.
 */
export const getInvitePreview = async (token: string): Promise<InvitePreview | null> => {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null
  const admin = supabaseAdmin()
  const hash = createHash("sha256").update(token).digest("hex")
  const { data } = await admin
    .from("workspace_invites")
    .select("email, role, workspace_id, invited_by, staff_id, accepted_at, revoked_at, expires_at, workspaces(name), staff(name)")
    .eq("token_hash", hash)
    .maybeSingle()
  const row = data as unknown as Row | null
  if (!row) return null
  let inviterName: string | null = null
  if (row.invited_by) {
    const m = await admin.from("workspace_members").select("display_name").eq("workspace_id", row.workspace_id).eq("user_id", row.invited_by).maybeSingle()
    inviterName = (m.data as { display_name: string } | null)?.display_name ?? null
  }
  const state: InviteState = row.revoked_at ? "revoked" : row.accepted_at ? "accepted" : new Date(row.expires_at).getTime() < Date.now() ? "expired" : "pending"
  return { workspaceName: row.workspaces?.name ?? "NIVO", email: row.email, role: row.role, staffName: row.staff?.name ?? null, inviterName, state }
}
