import "server-only"
import { listMembers, type MemberListing } from "@/lib/members"
import { supabaseServer } from "@/lib/supabase/server"
import { getSession } from "@/lib/session"

export type PendingInvite = {
  readonly id: string
  readonly email: string
  readonly role: "manager" | "staff"
  readonly staffName: string | null
  readonly createdAt: string
  readonly expiresAt: string
  readonly expired: boolean
}

export type StaffChoice = { readonly id: string; readonly name: string; readonly role: string }

export type TeamData = {
  readonly members: ReadonlyArray<MemberListing>
  readonly invites: ReadonlyArray<PendingInvite>
  /** Active staff rows nobody is linked to yet (candidates for "this person is"). */
  readonly staffChoices: ReadonlyArray<StaffChoice>
  /** Staff row names by id, for members linked to a staff row. */
  readonly staffNames: Readonly<Record<string, string>>
  readonly selfId: string
  readonly selfRole: "owner" | "manager" | "staff"
}

type InviteRow = { id: string; email: string; role: "manager" | "staff"; staff_id: string | null; created_at: string; expires_at: string }

/** Everything the Team page draws, in one pass. Owner | manager only (RLS also enforces it). */
export const loadTeam = async (): Promise<TeamData> => {
  const session = await getSession()
  const db = await supabaseServer()
  const wid = session.workspace.id
  const [members, invitesRes, staffRes] = await Promise.all([
    listMembers(),
    db.from("workspace_invites").select("id, email, role, staff_id, created_at, expires_at").eq("workspace_id", wid)
      .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    db.from("staff").select("id, name, role").eq("workspace_id", wid).eq("active", true).order("name"),
  ])
  if (invitesRes.error) throw new Error(invitesRes.error.message)
  const staff = (staffRes.data ?? []) as StaffChoice[]
  const nameOf = new Map(staff.map((s) => [s.id, s.name]))
  const now = Date.now()
  const rows = (invitesRes.data ?? []) as InviteRow[]
  const invites = rows.map((r): PendingInvite => ({
    id: r.id, email: r.email, role: r.role, staffName: r.staff_id ? nameOf.get(r.staff_id) ?? null : null,
    createdAt: r.created_at, expiresAt: r.expires_at, expired: new Date(r.expires_at).getTime() < now,
  }))
  const linked = new Set<string>([...members.map((m) => m.staffId), ...rows.filter((r) => new Date(r.expires_at).getTime() >= now).map((r) => r.staff_id)].filter((x): x is string => !!x))
  return { members, invites, staffChoices: staff.filter((s) => !linked.has(s.id)), staffNames: Object.fromEntries(nameOf), selfId: session.userId, selfRole: session.member.role }
}
