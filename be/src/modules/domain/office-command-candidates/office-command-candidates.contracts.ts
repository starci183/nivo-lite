import type { ProposedCommand } from "@modules/domain/ai-tasks"
import type { Locale } from "@modules/platform/i18n"

/** One labelled line of a command card ("Customer: Lan"). */
export interface ShownRow {
    /** The row key (`customer`, `order` or a payload key). */
    readonly key: string
    /** The label, in the language of the request. */
    readonly label: string
    /** The value. */
    readonly value: string
}

/** Where a command candidate stands. */
export type CandidateStatus = "pending" | "sent" | "cancelled"

/** A command NIVO proposed from an owner's message, waiting for the owner. */
export interface CandidateView {
    /** The candidate id. */
    readonly id: string
    /** The owner's message the card sits under. */
    readonly message_id: string
    /** The receiving module. */
    readonly module: string
    /** The command key of the receiver. */
    readonly command: string
    /** The payload the command will be sent with. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The one line the card shows. */
    readonly summary: string
    /** The card rows. */
    readonly shown: ReadonlyArray<ShownRow>
    /** Where the candidate stands. */
    readonly status: CandidateStatus
    /** The work item the command became, once sent. */
    readonly work_item_id: string | null
    /** Why the last send was refused; the card stays pending. */
    readonly refusal_detail: string | null
    /** When the candidate was created, ISO 8601. */
    readonly created_at: string
}

/** A customer the message may name. */
export interface LeadRef {
    /** The customer id. */
    readonly id: string
    /** The customer's name. */
    readonly name: string
    /** The customer's company, when known. */
    readonly company: string | null
}

/** An order the message may name. */
export interface OrderRef {
    /** The order id. */
    readonly id: string
    /** The order number as people write it. */
    readonly orderNo: string
    /** The customer it belongs to, or null. */
    readonly leadId: string | null
}

/** The references a message named: the only ids the model is offered. */
export interface MessageRefs {
    /** The customers named. */
    readonly leads: ReadonlyArray<LeadRef>
    /** The orders named. */
    readonly orders: ReadonlyArray<OrderRef>
}

/** What a command does, in both languages. */
export interface CommandDescription {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The message names no command of the agent. */
export interface UnmappedResolution {
    /** Discriminator. */
    readonly kind: "unmapped"
}

/** The command is known but the message lacks required keys. */
export interface MissingResolution {
    /** Discriminator. */
    readonly kind: "missing"
    /** The command key. */
    readonly command: string
    /** What the command does. */
    readonly description: CommandDescription
    /** The kind of record the command is about. */
    readonly subjectType: string
    /** The required keys still absent. */
    readonly missing: ReadonlyArray<string>
}

/** The command is complete and valid. */
export interface ReadyResolution {
    /** Discriminator. */
    readonly kind: "ok"
    /** The command key. */
    readonly command: string
    /** What the command does. */
    readonly description: CommandDescription
    /** The payload the command is sent with. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The customer the command is about. */
    readonly leadId: string | null
    /** The order the command is about. */
    readonly orderId: string | null
    /** The required keys other than the ids. */
    readonly extra: Readonly<Record<string, string | number>>
}

/** What a model's choice resolves to once validated against the agent's contract. */
export type Resolution = UnmappedResolution | MissingResolution | ReadyResolution

/** The catalog keys of the words that ask for a missing key. */
export type NeedKey = "office.cmdNeedOrder" | "office.cmdNeedLead" | "office.cmdNeedInvoice" | "office.cmdNeedOther"

/** The words of a missing key: the catalog key of its text and the value that fills `{{field}}`. */
export interface NeedText {
    /** The message catalog key. */
    readonly key: NeedKey
    /** The value of `{{field}}`. */
    readonly field: string
}

/** The labels of the card rows the policy cannot know: the customer and the order. */
export interface CardLabels {
    /** The label of the customer row. */
    readonly customer: string
    /** The label of the order row. */
    readonly order: string
}

/** What proposing a command from a message asks for. */
export interface ProposeRequest {
    /** The owner's message, already stored in the Office thread. */
    readonly messageId: string
    /** The language of the card and the replies. */
    readonly locale: Locale
}

/** The message is not for a command: the caller chats as before. */
export interface ChatOutcome {
    /** Discriminator. */
    readonly kind: "chat"
}

/** NIVO answered in the thread instead of showing a card. */
export interface ReplyOutcome {
    /** Discriminator. */
    readonly kind: "reply"
    /** The text NIVO posted. */
    readonly body: string
}

/** A command card was created. */
export interface CardOutcome {
    /** Discriminator. */
    readonly kind: "card"
    /** The candidate. */
    readonly candidate: CandidateView
}

/** What proposing a command from a message produced. */
export type ProposeOutcome = ChatOutcome | ReplyOutcome | CardOutcome

/** What a message names, with the lookup that turns a customer id into the name the card shows. */
export interface ReferencePool {
    /** The customers and orders the message named. */
    readonly refs: MessageRefs
    /** Customer names by id, for every customer of the pool the message was matched against. */
    readonly leadNames: ReadonlyMap<string, string>
}

/** What the model call produced: the reading, or the text of why there is none. */
export type CommandReading = ReadingSucceeded | ReadingFailed

/** The model answered. */
export interface ReadingSucceeded {
    /** Discriminator. */
    readonly ok: true
    /** What the model picked, not yet validated. */
    readonly choice: ProposedCommand
}

/** The model call failed. */
export interface ReadingFailed {
    /** Discriminator. */
    readonly ok: false
    /** The text of the failure, for the reply. */
    readonly error: string
}

/** What confirming a candidate asks for. */
export interface ConfirmRequest {
    /** The candidate. */
    readonly candidateId: string
    /** The language the receiver's Office line is written in. */
    readonly locale: Locale
}

/** Where a confirmed command went. */
export interface ConfirmResult {
    /** The work item the command became. */
    readonly workItemId: string
    /** The receiving module. */
    readonly module: string
    /** False when the same command about the same subject already existed. */
    readonly created: boolean
}

/** The position after which the next page of messages starts (keyset on created_at, id). */
export interface MessageCursor {
    /** The `created_at` of the oldest message of the previous page. */
    readonly createdAt: string
    /** The id of the oldest message of the previous page. */
    readonly id: string
}

/** A cursor, or null for the first page. */
export type OptionalMessageCursor = MessageCursor | null

/** What a thread listing asks for. */
export interface MessagePageQuery {
    /** Only messages older than this position; null for the newest page. */
    readonly before: OptionalMessageCursor
    /** The page size; clamped to 1..100. */
    readonly limit: number
    /** Only this Hub room; null reads every room (the Office room). */
    readonly room: string | null
}

/** One line of the Office thread. */
export interface MessageView {
    /** The message id. */
    readonly id: string
    /** Who wrote it. */
    readonly author_kind: "human" | "agent" | "system"
    /** The author's display name. */
    readonly author_name: string
    /** The account that wrote it; null on a legacy line or a line no member wrote. */
    readonly author_user_id: string | null
    /** The agent that wrote it, when one did. */
    readonly agent_id: string | null
    /** The staff member it was written as, or null for the owner. */
    readonly staff_id: string | null
    /** The text. */
    readonly body: string
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The work item it mirrors. */
    readonly work_item_id: string | null
    /** The customer's name, when the line names one. */
    readonly lead_name: string | null
    /** The department of the work item the line mirrors. */
    readonly department: string | null
    /** The Hub room of the line; null is the general Office room. */
    readonly room: string | null
    /** The result card payload as JSON text, when the line is a card. */
    readonly card_json: string | null
    /** The live state of the card: pending, approved, declined, done, failed, queued or info; null without a card. */
    readonly card_state: string | null
    /** When it was written, ISO 8601. */
    readonly created_at: string
}

/** One page of the thread, newest first. */
export interface MessagePage {
    /** The messages of the page, newest first. */
    readonly messages: ReadonlyArray<MessageView>
    /** The cursor of the next (older) page; null on the last one. */
    readonly next: OptionalMessageCursor
}

/** An agent execution waiting for or past a human decision, with the context its card needs. */
export interface ApprovalView {
    /** The execution id. */
    readonly id: string
    /** The responsibility it belongs to. */
    readonly responsibility_id: string
    /** The agent that drafted it. */
    readonly agent_id: string | null
    /** What kind of execution it is. */
    readonly kind: string
    /** The draft to approve. */
    readonly draft: string
    /** Where it stands. */
    readonly status: "pending_approval" | "approved" | "rejected"
    /** Who decided it. */
    readonly decided_by: string | null
    /** When it was decided, ISO 8601. */
    readonly decided_at: string | null
    /** When it was created, ISO 8601. */
    readonly created_at: string
    /** The work item behind it. */
    readonly work_item_id: string | null
    /** The customer, "name - company"; null when the responsibility has none. */
    readonly leadName: string | null
    /** The customer id. */
    readonly leadId: string | null
    /** The channel the customer came through; empty when unknown. */
    readonly channel: string
    /** The agent's name, else the responsibility owner's; null when neither is known. */
    readonly agentName: string | null
    /** The responsibility's next action; empty when unknown. */
    readonly nextAction: string
    /** The staff member the work item is assigned to; null means only owner and manager decide. */
    readonly assignedStaffId: string | null
}
