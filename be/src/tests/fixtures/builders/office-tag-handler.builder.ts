import type { ChatFileReadsService } from "@modules/domain/chat-files"
import type { AgentTurnView, AgentWakeContext } from "@modules/domain/agent-work"
import type { InternalProposalSettlerService } from "@modules/domain/agent-turns"
import type { AgentHeader } from "@modules/domain/agents"
import type { OfficeThreadLine } from "@modules/domain/messages"
import type { ProposeOutcome } from "@modules/domain/office-command-candidates"
import type { MemberDirectoryEntry } from "@modules/domain/workspace-members"

/** What the settler answers. */
type Settled = Awaited<ReturnType<InternalProposalSettlerService["settle"]>>

/** When the tagging wake was written. */
export const WAKE_AT: Date = new Date("2026-10-31T10:00:00.000Z")

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

type SettledInputShape = {
    kind: "settled"
}

/** What the settler answers for a proposal it applied. */
export const settled = (over: Partial<Extract<Settled, SettledInputShape>> = {}): Settled => ({
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

/** The read of the transfer picture attached to a tagged Office line. */
export const TAG_PICTURE_READ: NonNullable<Awaited<ReturnType<ChatFileReadsService["readOf"]>>> = {
    isTransfer: true,
    amountVnd: 3500000,
    recipient: "Shop",
    paidAt: null,
}

type TagPicturePlanPlanAttachmentsShape = {
    fileName: string
    mimeType: string
    content: string
}

type TagPicturePlanPlanShape = {
    module: string
    runtimeAgentId: string
    threadKey: string
    message: string
    attachments: Array<TagPicturePlanPlanAttachmentsShape>
    timeoutMs: number
}

type TagPicturePlanShape = {
    kind: string
    plan: TagPicturePlanPlanShape
}

/** Exact expected turn and picture data for an Office attachment. */
export const TAG_PICTURE_PLAN: TagPicturePlanShape = {
    kind: "run",
    plan: {
        module: "accounting",
        runtimeAgentId: "runtime-1",
        threadKey: "agent:runtime-1:office:main",
        message: "THE PROMPT",
        attachments: [{ fileName: "receipt.png", mimeType: "image/png", content: "AQID" }],
        timeoutMs: 60_000,
    },
}

/** Exact conversation and sender-provided evidence passed into the internal prompt. */
export const TAG_PICTURE_CONTEXT =
    "-> Lan: @ke-toan how much?\n\n[ATTACHED FILE] The sender attached a transfer record, read by NIVO; this comes from the sender. amount: 3500000 VND; recipient: Shop; time: not readable."

type TagPausedPostsShape2 = {
    body: string
    lead_id: null
    work_item_id: null
    room: string
    unlessSaidSince: Date
    workspaceId?: never
}

type TagPausedPostsShape = {
    workspaceId: string
    body?: never
    lead_id?: never
    work_item_id?: never
    room?: never
    unlessSaidSince?: never
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_PAUSED_POSTS: Array<Array<TagPausedPostsShape | TagPausedPostsShape2>> = [
    [
        { workspaceId: "ws-1" },
        {
            body: "office.tagPaused:ke-toan",
            lead_id: null,
            work_item_id: null,
            room: "accounting",
            unlessSaidSince: WAKE_AT,
        },
    ],
]

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_OFFICE_RUN = {
    kind: "run",
    plan: {
        module: "accounting",
        runtimeAgentId: "runtime-1",
        threadKey: "agent:runtime-1:office:main",
        message: "THE PROMPT",
        timeoutMs: 60_000,
    },
}

type TagTranscriptContextShape = {
    workspaceId: string
    agentId: string
    source: string
    locale: string
    text: string
    wake: AgentTurnView
    agentName: string
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_TRANSCRIPT_CONTEXT: TagTranscriptContextShape = {
    workspaceId: "ws-1",
    agentId: "agent-kt",
    source: "tag",
    locale: "vi",
    text: "An: good morning\n-> Lan: @ke-toan how much is due?",
    wake: turnOf(),
    agentName: "Ke toan",
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_THREAD_RUN = {
    kind: "run",
    plan: {
        module: "accounting",
        runtimeAgentId: "runtime-1",
        threadKey: "agent:runtime-1:thread:th-1",
        message: "THE PROMPT",
        timeoutMs: 60_000,
    },
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_SETTLED_REPLY = {
    status: "done",
    reason: null,
    outcome: { replied: true, tasks: 1, actions: 0, needsHuman: false, workItemId: null },
}

type TagReplyPostsShape2 = {
    body: string
    lead_id: null
    work_item_id: null
    room: string
    unlessSaidSince: Date
    agent_id: string
    workspaceId?: never
}

type TagReplyPostsShape = {
    workspaceId: string
    body?: never
    lead_id?: never
    work_item_id?: never
    room?: never
    unlessSaidSince?: never
    agent_id?: never
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_REPLY_POSTS: Array<Array<TagReplyPostsShape | TagReplyPostsShape2>> = [
    [
        { workspaceId: "ws-1" },
        {
            body: "It is 5tr.",
            lead_id: null,
            work_item_id: null,
            room: "accounting",
            unlessSaidSince: WAKE_AT,
            agent_id: "agent-kt",
        },
    ],
]

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_SETTLED_WORK = {
    status: "done",
    reason: null,
    outcome: { replied: false, tasks: 1, actions: 2, needsHuman: true, workItemId: "item-9" },
}

/** Exact deterministic expected Office value used by the handler specification. */
export const TAG_GONE_END = {
    status: "skipped",
    reason: "agent_gone",
    outcome: null,
}
