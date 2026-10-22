import type { ChainActor, ChainStopReason, MentionRef } from "@modules/domain/work-chains"
import type { WorkThread } from "@modules/domain/work-threads"
import type { Locale } from "@modules/platform/i18n"

/** A member as the authority and approval capabilities name them. */
export interface MemberRef {
    /** The member id in the workspace (`workspace_members.id`). */
    readonly memberId: string
    /** The member's display name. */
    readonly name: string
    /** owner, manager or staff. */
    readonly role: string
    /** The key of the room the member sits in, or null. */
    readonly roomId: string | null
}

/** How the people tagged by an approval decide: any one of them, all of them, or one after another. */
export type ApprovalPolicy = "any" | "all" | "sequential"

/** Where an approval card stands. */
export type ApprovalOutcome = "pending" | "approved" | "rejected" | "expired"

/** A thread in the list: the thread, its newest line and whether an approval waits in it. */
export interface ThreadListing extends WorkThread {
    /** The newest message's text, or null for an empty thread. */
    readonly lastBody: string | null
    /** When the newest message was written, ISO 8601, or null. */
    readonly lastAt: string | null
    /** How many messages the thread has. */
    readonly messageCount: number
    /** True while an approval card of the thread is pending. */
    readonly waitingApproval: boolean
}

/** A tag as the thread shows it: who, with the name the chip carries. */
export interface MentionView extends MentionRef {
    /** The name on the chip, as it was when the tag was made. */
    readonly name: string
}

/** One tagged approver on a card and what they did. */
export interface CardApprover extends MemberRef {
    /** waiting, approved or rejected. */
    readonly status: "waiting" | "approved" | "rejected"
}

/** One person left out of the tagged set and why. */
export interface CardExcluded {
    /** The member's Auth user id. */
    readonly memberId: string
    /** The member's display name. */
    readonly name: string
    /** The reason the gate gave. */
    readonly reason: string
}

/** The approval card a message carries: the rule, the policy, the clock, the tagged set and the outcome. */
export interface ApprovalCard {
    /** The approval request. */
    readonly requestId: string
    /** What is asked, for example "Discount 8%". */
    readonly action: string
    /** The amount asked, in the unit, or null. */
    readonly amount: number | null
    /** The unit of the amount (vnd, percent, count), or null. */
    readonly unit: string | null
    /** The authority rule that governs the ask, as the agent named it. */
    readonly rule: string
    /** How the tagged people decide. */
    readonly policy: ApprovalPolicy
    /** When the ask expires, ISO 8601. */
    readonly expiresAt: string
    /** The people tagged, with what each did. */
    readonly approvers: ReadonlyArray<CardApprover>
    /** The people left out, with the reason. */
    readonly excluded: ReadonlyArray<CardExcluded>
    /** Where the ask stands. */
    readonly outcome: ApprovalOutcome
    /** The member id of who decided, or null. */
    readonly decidedBy: string | null
    /** The name of who decided, or null. */
    readonly decidedByName: string | null
    /** When it was decided, ISO 8601, or null. */
    readonly decidedAt: string | null
    /** The owner an expired or refused ask goes back to. */
    readonly owner: MentionView | null
}

/** One message of a thread. */
export interface ThreadMessage {
    /** The message id. */
    readonly id: string
    /** The thread. */
    readonly threadId: string
    /** Who wrote it: member or agent. */
    readonly authorKind: "member" | "agent"
    /** The member id (`workspace_members.id`) or the agent id of the author. */
    readonly authorId: string
    /** The author's display name. */
    readonly authorName: string
    /** The member's role or the agent's module. */
    readonly authorRole: string
    /** What was written. */
    readonly body: string
    /** Customer words the author quoted: data, never a tag. */
    readonly quoted: ReadonlyArray<string>
    /** The people, agents and groups the author tagged. */
    readonly mentions: ReadonlyArray<MentionView>
    /** The approval card the message carries, or null. */
    readonly approval: ApprovalCard | null
    /** When it was written, ISO 8601. */
    readonly createdAt: string
}

/** One line written into a thread. */
export interface ThreadLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** Who writes it. */
    readonly author: ChainActor
    /** What is written. */
    readonly body: string
    /** Quoted customer words. */
    readonly quoted: ReadonlyArray<string>
    /** The tags, with their chip names. */
    readonly mentions: ReadonlyArray<MentionView>
    /** The approval card the line carries, or null. */
    readonly card: ApprovalCard | null
}

/** A member writes in a thread. */
export interface MemberPost {
    /** The workspace the caller acts in. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The member id of the author (`workspace_members.id`). */
    readonly memberId: string
    /** What is written. */
    readonly body: string
    /** The tags the author chose; never read out of the text. */
    readonly mentions: ReadonlyArray<MentionRef>
    /** Customer words to quote. */
    readonly quoted: ReadonlyArray<string>
    /** The language of the texts the capability writes. */
    readonly locale: Locale
}

/** A signed-in account writes in a thread as the member it is in the workspace. */
export interface UserPost extends Omit<MemberPost, "memberId"> {
    /** The signed-in account. */
    readonly userId: string
}

/** What an amount is counted in: money, a percentage or a count. */
export type ApprovalUnit = "vnd" | "percent" | "count"

/** What an agent asks people to approve with its message. */
export interface ApprovalAsk {
    /** The action key whose authority rule decides who approves. */
    readonly actionKey: string
    /** What is asked, in words, for example "Discount 12%". */
    readonly title: string
    /** The amount, or null when the action carries none. */
    readonly amount: number | null
    /** The unit of the amount, which must be the unit of the rule. */
    readonly unit: ApprovalUnit
    /** The authority rule that governs the ask. */
    readonly rule: string
}

/** An agent writes in a thread. */
export interface AgentPost {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The agent that writes. */
    readonly agentId: string
    /** What is written. */
    readonly body: string
    /** The tags the agent chose; never read out of the text. */
    readonly mentions: ReadonlyArray<MentionRef>
    /** Customer words to quote. */
    readonly quoted: ReadonlyArray<string>
    /** The title of the chain step the message makes; null takes it from the text. */
    readonly stepTitle: string | null
    /** What the message asks people to approve, or null. */
    readonly approval: ApprovalAsk | null
    /** The language of the texts the capability writes. */
    readonly locale: Locale
}

/** What an agent's post answers: the message and, when the chain limits stopped it, why. */
export interface PostedAgentMessage {
    /** The stored message. */
    readonly message: ThreadMessage
    /** Why the chain stopped and went back to the owner; null while it goes on. */
    readonly stopped: ChainStopReason | null
}

/** A signed-in account opens a thread. */
export interface NewThread {
    /** The workspace the caller acts in. */
    readonly workspaceId: string
    /** The signed-in account. */
    readonly userId: string
    /** The title. */
    readonly title: string
    /** The lead the thread is about, or null. */
    readonly leadId: string | null
    /** The order the thread is about, or null. */
    readonly orderId: string | null
}

/** A thread with its messages, oldest first. */
export interface ThreadView {
    /** The thread. */
    readonly thread: WorkThread
    /** The newest messages, oldest first. */
    readonly messages: ReadonlyArray<ThreadMessage>
}

/** A signed-in account decides an approval card as the member it is in the workspace. */
export interface CardDecision {
    /** The workspace the caller acts in. */
    readonly workspaceId: string
    /** The message that carries the card. */
    readonly messageId: string
    /** The signed-in member. */
    readonly userId: string
    /** Approve or reject. */
    readonly verdict: "approve" | "reject"
    /** The language of the texts the capability writes. */
    readonly locale: Locale
}

/** A member's verdict on an approval request, as the gate takes it. */
export interface ApprovalDecision {
    /** The approval request. */
    readonly requestId: string
    /** The member id of whoever decides (`workspace_members.id`). */
    readonly memberId: string
    /** Approve or reject. */
    readonly verdict: "approve" | "reject"
}

/** The gate answered a verdict: the request is settled, or it waits for more people. */
export interface ApprovalDecisionResult {
    /** pending while more people must decide, else how the request ended. */
    readonly status: ApprovalOutcome
}

/** The event the approval capability raises when a request ends. */
export interface ApprovalResolved {
    /** The approval request. */
    readonly requestId: string
    /** How it ended. */
    readonly outcome: "approved" | "rejected" | "expired"
    /** The member id of who decided it, or null when it expired. */
    readonly decidedBy: string | null
}

/** What opening an approval request takes. */
export interface OpenApproval {
    /** The workspace. */
    readonly workspaceId: string
    /** The chain step that waits on it. */
    readonly chainStepId: string
    /** The action key whose authority rule decides who approves. */
    readonly action: string
    /** The amount, or null when the action carries none. */
    readonly amount: number | null
    /** The unit of the amount. */
    readonly unit: ApprovalUnit
    /** The agent that asks. */
    readonly requestedByAgentId: string
}

/** What an opened approval answers: the people to tag after the limits filter, the ones left out, the policy and the deadline. */
export interface OpenedApproval {
    /** The request id. */
    readonly requestId: string
    /** The people tagged. */
    readonly approvers: ReadonlyArray<MemberRef>
    /** The people left out and why. */
    readonly excluded: ReadonlyArray<{ readonly memberId: string; readonly reason: string }>
    /** How the people decide. */
    readonly policy: ApprovalPolicy
    /** When the ask expires, ISO 8601. */
    readonly expiresAt: string
}

/** A person, agent or group a composer can tag. */
export interface MentionOption {
    /** member, agent or group. */
    readonly kind: MentionRef["kind"]
    /** The id to tag. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The role line: a member's role, an agent's module, a group's kind. */
    readonly role: string
}

/** An assignment from the agent page: a member opens a thread by giving an agent work. */
export interface AssignmentOpen {
    /** The workspace. */
    readonly workspaceId: string
    /** The member id of whoever gives the work (`workspace_members.id`). */
    readonly authorMemberId: string
    /** The title of the thread. */
    readonly title: string
    /** The text of the first message: plain data, never read for tags. */
    readonly text: string
    /** The tags: the agent that gets the work. */
    readonly mentions: ReadonlyArray<MentionRef>
    /** The language of the texts the capability writes; Vietnamese when absent. */
    readonly locale?: Locale
}

/** The thread an assignment opened. */
export interface OpenedAssignment {
    /** The new thread. */
    readonly threadId: string
}

/** Display names by member id. */
export interface MemberNames {
    /** The display name of the member with this id. */
    readonly [memberId: string]: string
}

/** Asks whether the agents capability allows one agent to be tagged or given work. */
export type AgentGate = (agentId: string) => Promise<boolean>

/** How an approval card ended: how, by whom (member id and name) or by nobody. */
export interface CardEnding {
    /** How it ended. */
    readonly outcome: Exclude<ApprovalOutcome, "pending">
    /** The member id of who decided, or null. */
    readonly decidedBy: string | null
    /** The name of who decided, or null. */
    readonly decidedByName: string | null
}

/** The three sections of the composer's `@` list. */
export interface MentionDirectory {
    /** The people of the workspace. */
    readonly members: ReadonlyArray<MentionOption>
    /** The active agents. */
    readonly agents: ReadonlyArray<MentionOption>
    /** The groups: roles and rooms. */
    readonly groups: ReadonlyArray<MentionOption>
}

/** Most tags one message may carry. */
export const MAX_MENTIONS = 10

/** Most customer quotes one message may carry. */
export const MAX_QUOTES = 5

/** Longest customer quote, in characters. */
export const MAX_QUOTE_LENGTH = 2000

/** The longest chain step title a message makes. */
export const MAX_STEP_TITLE = 80
