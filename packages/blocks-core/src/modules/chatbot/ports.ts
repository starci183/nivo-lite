import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListPage, ListSource } from "@nivo-lite/agent-sdk/block"
import type { HandlingMember } from "../../rules/chatbot"
import type {
    ChatSendInput,
    ChatSendResult,
    LeadFacts,
    MessagePatch,
    MessageRecord,
    NewMessage,
    ProposalPatch,
    ThreadPatch,
    ThreadRow,
    UpdateOutcome,
} from "./chatbot.types"

/*
 * The data ports of the Chatbot module. Each mirrors the engine port of one entity (`get`, `update` with the expected version,
 * `insert`, a keyset page): the host swaps each for `entityPort(<entity>)` in one place when the engine lands, so reads and actions
 * never change.
 */

/** The conversations list: the engine turns a list shape and a query into one query over `chat.conversation`. */
export type ThreadsList = ListSource<ThreadRow>

/** The conversations of the workspace (`chat.conversation`). */
export interface ConversationStore {
    /** One conversation; null when the workspace has none by this id. */
    readonly get: (id: string) => Promise<ThreadRow | null>
    /** Sets fields of a conversation when its version is still the expected one. */
    readonly update: (id: string, expected: string, patch: ThreadPatch) => Promise<UpdateOutcome<ThreadRow>>
}

/** The lines of the conversations (`chat.message`). */
export interface MessageStore {
    /** One line; null when the workspace has none by this id. */
    readonly get: (id: string) => Promise<MessageRecord | null>
    /** Stores a line and answers the stored record. */
    readonly insert: (message: NewMessage) => Promise<MessageRecord>
    /** Sets the outcome of a push, or the answer to a proposal, when the version of the line is still the expected one. */
    readonly update: (
        id: string,
        expected: string,
        patch: MessagePatch | ProposalPatch,
    ) => Promise<UpdateOutcome<MessageRecord>>
    /** The reply the AI proposed in a conversation and nobody answered yet; null when there is none. */
    readonly proposed: (conversationId: string) => Promise<MessageRecord | null>
    /** A keyset page of the posted lines of one conversation, newest first; the cursor continues to older ones. */
    readonly page: (conversationId: string, cursor: string | null, size: number) => Promise<ListPage<MessageRecord>>
}

/** The members of the workspace, as far as handling a conversation cares. */
export interface MemberDirectory {
    /** The member by id; null when the workspace has none. */
    readonly get: (memberId: string) => Promise<HandlingMember | null>
}

/** The customers of the workspace (`sales.lead`). */
export interface LeadDirectory {
    /** The customer facts by id; null when the workspace has none. */
    readonly get: (id: string) => Promise<LeadFacts | null>
}

/** The names of the jobs this module enqueues. */
export type ChatbotJobName = "chatbot.deliver-reply"

/** What delivering a reply is told. */
export interface DeliverReplyInput {
    /** The stored line to push to the customer's channel. */
    readonly messageId: string
}

/** The outbox: enqueues a declared job in the same transaction as the write that needs it. */
export interface ChatOutbox {
    /** Enqueues a job. */
    readonly enqueue: (job: ChatbotJobName, input: DeliverReplyInput) => Promise<void>
}

/** The door a job calls out through, by domain tool name; never inside a transaction. */
export interface ChatDoor {
    /** Asks the customer's channel to send a text. */
    readonly call: (tool: "chat.send", input: ChatSendInput) => Promise<ChatSendResult>
}

/** The port the inbox list runs on. */
export const THREADS_LIST: PortDefinition<ThreadsList> = definePort<ThreadsList>("chatbot.threads-list")

/** The port of the conversations. */
export const CONVERSATIONS: PortDefinition<ConversationStore> = definePort<ConversationStore>("chatbot.conversations")

/** The port of the lines. */
export const MESSAGES: PortDefinition<MessageStore> = definePort<MessageStore>("chatbot.messages-store")

/** The port of the members. */
export const MEMBERS: PortDefinition<MemberDirectory> = definePort<MemberDirectory>("chatbot.members")

/** The port of the customers. */
export const LEADS: PortDefinition<LeadDirectory> = definePort<LeadDirectory>("chatbot.leads")

/** The port of the outbox. */
export const OUTBOX: PortDefinition<ChatOutbox> = definePort<ChatOutbox>("chatbot.outbox")

/** The port of the door. */
export const DOOR: PortDefinition<ChatDoor> = definePort<ChatDoor>("chatbot.door")
