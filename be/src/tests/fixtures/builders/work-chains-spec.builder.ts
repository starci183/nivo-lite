import { rowOf } from "./work-chains.builder"

/** The twelve automatic steps of one thread, the most a chain may hold. */
export const twelveSteps = Array.from({ length: 12 }, (_, index) =>
    rowOf({ id: `s${index}`, seq: index + 1, actor_id: `a${index}` }),
)

/** The settlement of the approval request `req-1` of the first workspace. */
export const approval = (
    outcome: "approved" | "rejected" | "expired",
    decidedBy: string | null,
    locale: "vi" | "en" = "vi",
) => ({
    workspaceId: "ws-1",
    approvalRequestId: "req-1",
    outcome,
    decidedBy,
    locale,
})

/** What the message catalog answers: the key and the parameters, so a spec can see both. */
export const catalogText = (key: string, params: Readonly<Record<string, string | number>>): string =>
    `${key}|${JSON.stringify(params)}`

/** The directory answer for the owner of the agent: a member and the member to fall back to. */
export const OWNER_FACTS = { ownerMemberId: "owner-1", fallbackMemberId: "fallback-1" }

/** The active members the directory answers, each named by its id and managing. */
export const activeMembersOf = (active: ReadonlyArray<{ readonly id: string }> | undefined) =>
    (active ?? [{ id: "owner-1" }]).map(({ id }) => ({ id, displayName: id, role: "manager" as const }))

/** The member the directory finds by id, or none when the answers name none. */
export const namedMemberOf = (name: ReadonlyArray<{ readonly name: string }> | undefined) => {
    const [named] = name ?? [{ name: "Mr Minh" }]
    return named === undefined ? null : { id: "minh", displayName: named.name, role: "manager" as const }
}

/** Two steps, the second an approval decided by the owner four minutes after it began. */
export const decidedHistory = [
    rowOf({ id: "s1", seq: 1 }),
    rowOf({
        id: "s2",
        seq: 2,
        kind: "ask_approval",
        decided_by: "owner-1",
        started_at: new Date("2026-10-22T09:41:00+07:00"),
        finished_at: new Date("2026-10-22T09:45:00+07:00"),
    }),
]

/** Three steps by actors the directories may or may not know: a member, a vanished member and an unknown agent. */
export const mixedActorHistory = [
    rowOf({ id: "s1", seq: 1, actor_kind: "member", actor_id: "minh" }),
    rowOf({ id: "s2", seq: 2, actor_kind: "member", actor_id: "gone" }),
    rowOf({ id: "s3", seq: 3, actor_kind: "agent", actor_id: "agent-9" }),
]
