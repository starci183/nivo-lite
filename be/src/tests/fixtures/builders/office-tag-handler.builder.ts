import type { AgentTurnView, AgentWakeContext } from "@modules/domain/agent-work"
import type { InternalProposalSettlerService } from "@modules/domain/agent-turns"
import type { AgentHeader } from "@modules/domain/agents"
import type { OfficeThreadLine } from "@modules/domain/messages"
import type { ProposeOutcome } from "@modules/domain/office-command-candidates"
import type { MemberDirectoryEntry } from "@modules/domain/workspace-members"

/** What the settler answers. */
type Settled = Awaited<ReturnType<InternalProposalSettlerService["settle"]>>

/** When the tagging wake was written. */
export const WAKE_AT = new Date("2026-10-31T10:00:00.000Z")

/** The accounting agent that is tagged. */
export const KE_TOAN: AgentHeader = {
    id: "agent-kt",
    name: "Ke toan",
    handle: "ke-toan",
    role: "Accountant",
    module: "accounting",
    status: "active",
    avatarUrl: null,
}

/** The owner who tags. */
export const OWNER: MemberDirectoryEntry = { id: "member-1", displayName: "Lan", role: "owner" }
/** A staff member who tags. */
export const STAFF: MemberDirectoryEntry = { id: "member-1", displayName: "Van", role: "staff" }

/** The turn of a tag wake of the accounting agent, with the context overridden by the spec. */
export const turnOf = (context: AgentWakeContext = {}): AgentTurnView => ({
    workspaceId: "ws-1",
    agentId: "agent-kt",
    scopeKey: "agent",
    fence: 1,
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "tag",
    eventKey: "msg-1",
    context: { messageId: "msg-1", authorUserId: "user-1", locale: "vi", ...context },
    actorMemberId: "member-1",
    attempts: 1,
    maxAttempts: 3,
    wakeCreatedAt: WAKE_AT,
    proposal: null,
})

/** One stored line of the Office thread. */
export const lineOf = (id: string, over: Partial<OfficeThreadLine> = {}): OfficeThreadLine => ({
    id,
    author_kind: "human",
    author_name: "Lan",
    author_user_id: "user-1",
    agent_id: null,
    staff_id: null,
    body: `body ${id}`,
    lead_id: null,
    work_item_id: null,
    room: null,
    card_json: null,
    created_at: "2026-10-31T09:59:00.000Z",
    ...over,
})

/** What the settler answers for a proposal it applied. */
export const settled = (over: Partial<Extract<Settled, { kind: "settled" }>> = {}): Settled => ({
    kind: "settled",
    reply: "It is 5tr.",
    needsHuman: false,
    reason: "",
    tasks: 1,
    actions: [],
    ...over,
})

/** The command card the command reader answers. */
export const cardOutcome = (): ProposeOutcome => ({
    kind: "card",
    candidate: {
        id: "cand-1",
        message_id: "msg-1",
        module: "accounting",
        command: "send_reminder",
        payload: {},
        summary: "Remind",
        shown: [],
        status: "pending",
        work_item_id: null,
        refusal_detail: null,
        created_at: "2026-10-31T10:00:00.000Z",
    },
})
