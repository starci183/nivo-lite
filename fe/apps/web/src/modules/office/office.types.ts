import type { InstallationConnectionNeed } from "@/modules/installations"
import type { OfficeRoomMembersView } from "@/modules/types"

/** Who wrote a line. */
export type OfficeAuthorKind = "human" | "agent" | "system"

/** One line of the Office thread. */
export interface OfficeMessage {
    readonly id: string
    readonly authorKind: OfficeAuthorKind
    readonly authorName: string
    readonly body: string
    readonly createdAt: string
    readonly agentId: string | null
    readonly leadId: string | null
    readonly workItemId: string | null
    /** The Hub room of the line; null is the general Office room. */
    readonly room: string | null
    /** The agent result card of the line, when it is one. */
    readonly card: OfficeCardPayload | null
    /** The live state of the card (pending, approved, declined, done, failed, queued, info). */
    readonly cardState: string | null
}

/** The WebVTT captions of a card video, as the editor produced them. */
export interface OfficeCardCaptions {
    readonly url: string
    /** The captions language tag, or null when it is not known. */
    readonly lang: string | null
}

/** One image or video of a result card; only a video carries captions. */
export interface OfficeCardMediaPayload {
    readonly kind: "image" | "video"
    readonly url: string
    readonly caption: string | null
    /** The captions track, or null when the video has none. */
    readonly captions: OfficeCardCaptions | null
}

/** An agent result card (contract v1, be/docs/guides/hub-rooms-and-cards.md) as the Hub draws it. */
export interface OfficeCardPayload {
    readonly type:
        | "draft_post"
        | "video_ready"
        | "approval_request"
        | "schedule_confirmed"
        | "weekly_report"
        | "daily_summary"
        | "handoff_note"
        | "exception"
        | "action_done"
    readonly title: string
    readonly subtitle: string | null
    readonly badge: string | null
    readonly body: string | null
    readonly fields: ReadonlyArray<{ readonly label: string; readonly value: string }>
    readonly media: ReadonlyArray<OfficeCardMediaPayload>
    readonly lines: ReadonlyArray<{ readonly at: string; readonly text: string }>
    readonly link: { readonly label: string; readonly href: string } | null
    readonly ref: { readonly kind: "execution" | "work_item"; readonly id: string } | null
    /** The sources the agent used (data layer and label), in the order it gave them. */
    readonly sources: ReadonlyArray<{ readonly layer: number; readonly label: string }>
    readonly canApprove: boolean
    readonly canDecline: boolean
    readonly canEdit: boolean
}

/** One Hub room: the general Office room (key null) or a department room. */
export interface OfficeRoom {
    readonly key: string | null
    readonly name: string
    readonly unread: number
    readonly lastBody: string | null
    readonly lastAuthor: string | null
    readonly lastAt: string | null
    readonly agentIds: ReadonlyArray<string>
    readonly homeAgentIds: ReadonlyArray<string>
    readonly userIds: ReadonlyArray<string>
    readonly members: OfficeRoomMembersView
    readonly pins: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly href: string | null
        readonly note: string
    }>
}

/** One approval request (an execution waiting for, or already given, a decision). */
export interface OfficeApproval {
    readonly id: string
    readonly status: "pending_approval" | "approved" | "rejected"
    readonly draft: string
    readonly createdAt: string
    readonly decidedAt: string | null
    readonly decidedBy: string | null
    readonly agentId: string | null
    readonly agentName: string | null
    readonly assignedStaffId: string | null
    readonly channel: string
    readonly leadId: string | null
    readonly leadName: string | null
    readonly nextAction: string
}

/** The confirm card of an owner's command message. */
export interface OfficeCandidate {
    readonly id: string
    readonly messageId: string
    readonly module: string
    readonly command: string
    readonly summary: string
    readonly status: "pending" | "sent" | "cancelled"
    readonly refusal: string | null
    readonly workItemId: string | null
    readonly shown: ReadonlyArray<{ readonly key: string; readonly label: string; readonly value: string }>
}

/** One work item as the exception cards use it. */
export interface OfficeWork {
    readonly id: string
    readonly action: string
    readonly department: string
    readonly status: string
    readonly reason: string | null
    readonly error: string | null
    readonly createdAt: string
    readonly updatedAt: string
    readonly completedAt: string | null
    readonly assignedStaffId: string | null
    readonly leadId: string | null
    readonly executionId: string | null
    readonly decidedPath: string | null
    readonly missingFields: ReadonlyArray<string>
    readonly summary: string
    readonly draft: string | null
    readonly amountVnd: number | null
    readonly candidates: ReadonlyArray<{ readonly id: string; readonly label: string; readonly amountVnd: number }>
    readonly fields: unknown
    readonly resultSummary: string | null
}

/** An installed agent. */
export interface OfficeAgent {
    readonly id: string
    readonly module: string
    readonly name: string
    readonly handle: string
    /** The picture the owner gave the agent; null draws the generated avatar of its id. */
    readonly avatarUrl: string | null
    /** The agent is live and on duty. */
    readonly isActive: boolean
    /** The roles a `needs_connection` agent waits for, each with the connectors that would satisfy it; null otherwise. */
    readonly waitsFor: ReadonlyArray<InstallationConnectionNeed> | null
}

/** One account of the workspace. */
export interface OfficePerson {
    readonly userId: string
    readonly name: string
    readonly role: "owner" | "manager" | "staff"
    readonly staffId: string | null
    readonly lastSeen: string | null
}

/** One staff row of the workspace. */
export interface OfficeStaff {
    readonly id: string
    readonly name: string
    readonly role: string
}

/** One lead of the board, as the customer list and the lead chips use it. */
export interface OfficeLead {
    readonly id: string
    readonly name: string
    readonly preview: string | null
    readonly createdAt: string
}

/** One team task. */
export interface OfficeTask {
    readonly id: string
    readonly leadId: string
    readonly title: string
    readonly status: "open" | "waiting_approval" | "done"
    readonly nextAction: string
    readonly ownerName: string
    readonly leadName: string
    readonly dueAt: string | null
}
