import { listMembers } from "@/lib/members"
import { getSession } from "@/lib/session"
import { staffHandles } from "@/lib/staff-handle"
import { supabaseServer } from "@/lib/supabase/server"
import { OfficeMessenger as OfficeMessengerClient, type OfficeMessengerProps as ClientProps } from "./messenger"
import type { OfficePerson } from "./members"

export type { CustomerEntry } from "./conversations"

/** What the page passes: the messenger's data. The signed-in member, the team and who decided what are added here. */
export type OfficeMessengerProps = Omit<ClientProps, "people" | "deciders">

/**
 * Office as a messenger. Server wrapper: it adds the real team (every account in the workspace with role and last seen)
 * and the real name behind each decided card, then hands plain data to the client messenger.
 */
export const OfficeMessenger = async (props: OfficeMessengerProps) => {
  const [session, accounts] = await Promise.all([getSession(), listMembers().catch(() => [])])
  const active = props.staff.filter((s) => s.active)
  const handles = staffHandles(active, props.agents.map((a) => a.handle))
  const people: ReadonlyArray<OfficePerson> = accounts
    .filter((m) => m.status === "active")
    .map((m) => ({
      userId: m.userId,
      name: m.displayName,
      role: m.role,
      staffId: m.staffId,
      handle: m.staffId ? (handles.get(m.staffId) ?? null) : null,
      lastSeenIso: m.lastSignInAt,
      isMe: m.userId === session.userId,
    }))

  const decidedIds = props.decidedExceptions.map((i) => i.id)
  const deciders: Record<string, string> = {}
  if (decidedIds.length) {
    const db = await supabaseServer()
    const { data } = await db.from("decisions").select("work_item_id, decided_by, created_at").in("work_item_id", decidedIds).order("created_at", { ascending: true })
    for (const row of (data ?? []) as Array<{ work_item_id: string | null; decided_by: string }>) if (row.work_item_id) deciders[row.work_item_id] = row.decided_by
  }

  return <OfficeMessengerClient {...props} userName={session.userName} people={people} deciders={deciders} />
}
