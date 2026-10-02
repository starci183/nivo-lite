import { listMembers } from "@/lib/members"
import { getSession } from "@/lib/session"
import { staffHandles } from "@/lib/staff-handle"
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

  // The page loads each decided card with its latest decider already embedded (no extra request here).
  const deciders: Record<string, string> = {}
  for (const item of props.decidedExceptions) if (item.decidedBy) deciders[item.id] = item.decidedBy

  return <OfficeMessengerClient {...props} userName={session.userName} people={people} deciders={deciders} />
}
