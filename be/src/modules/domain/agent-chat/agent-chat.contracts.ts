import type { ChatConversation } from "@modules/domain/agent-conversations"
import type { AgentThreadMessage } from "@modules/domain/agent-messages"
import type { ChatFileFacts, ChatFileView } from "@modules/domain/chat-files"

/** The workspace selected by the caller and proved by the service. */
export interface AgentChatScope {
    /** The workspace id. */
    readonly workspaceId: string
}

/** The agent whose page or history the caller opens. */
export interface AgentChatAgentRequest extends AgentChatScope {
    /** The agent in the selected workspace. */
    readonly agentId: string
}

/** The page's bounded arguments. */
export interface AgentChatPageRequest extends AgentChatAgentRequest {
    /** Whether to evaluate the welcome banner. */
    readonly welcome: boolean
}

/** An existing thread in the selected workspace. */
export interface AgentChatConversationRequest extends AgentChatScope {
    /** The conversation id. */
    readonly conversationId: string
}

/** Values opening an owner test chat or a test customer chat. */
export interface StartAgentChatRequest extends AgentChatAgentRequest {
    /** Test or customer. */
    readonly kind: "test" | "customer"
    /** Visitor name, or null for the default. */
    readonly visitorName: string | null
}

/** A file that was uploaded for a message. */
export interface SentChatFile {
    /** The object path the upload address answered. */
    readonly path: string
    /** The name of the file. */
    readonly name: string
}

/** The text whose work is queued atomically with its storage. */
export interface SendAgentChatRequest extends AgentChatConversationRequest {
    /** The message body, bounded to 4000 characters; may be empty when a file goes with it. */
    readonly body: string
    /** The file sent with the message, or null. */
    readonly file: SentChatFile | null
}

/** A file about to be uploaded for a message of a conversation. */
export type RequestChatFileUpload = AgentChatConversationRequest & ChatFileFacts

/** A message of the thread with the files that came with it. */
export interface AgentChatMessage extends AgentThreadMessage {
    /** The files, oldest first. */
    readonly files: ReadonlyArray<ChatFileView>
}

/** A person taking a chat over or handing it back to the agent. */
export interface TakeOverAgentChatRequest extends AgentChatConversationRequest {
    /** True to take over, false to return to the agent. */
    readonly take: boolean
    /** A system line to record; {user} becomes the caller's display name. */
    readonly line: string
}

/** The stored message whose queued turn is being followed. */
export interface AgentChatTurnStatusRequest extends AgentChatScope {
    /** The submitted message id. */
    readonly id: string
}

/** The metadata AgentChatPage needs. */
export interface AgentChatPageData {
    /** The agent id. */
    readonly id: string
    /** The agent's module. */
    readonly module: string
    /** The agent display name. */
    readonly name: string
    /** Its mention handle. */
    readonly handle: string
    /** Its role line. */
    readonly role: string
    /** The HTTPS address of the agent's picture, or null for the default mascot. */
    readonly avatarUrl: string | null
    /** Whether the agent is active. */
    readonly isActive: boolean
    /** Whether the page offers the test customer chat. */
    readonly hasCustomerChannel: boolean
    /** The workspace selected by the caller. */
    readonly workspaceId: string
    /** Whether this arrival qualifies for the campaign welcome banner. */
    readonly showWelcome: boolean
}

/** The immediately accepted chat work, identified by its stored message. */
export interface QueuedAgentChatTurn {
    /** The stored message id used to poll status. */
    readonly id: string
    /** The thread to refresh when the job completes. */
    readonly conversationId: string
    /** Work has been durably queued. */
    readonly status: "queued"
}

/** The holder written by a takeover command. */
export interface AgentChatHolder {
    /** The affected conversation. */
    readonly conversationId: string
    /** A person's display name, or null when the AI holds it. */
    readonly handledBy: string | null
}

/** Authoritative state of a queued chat turn or human delivery. */
export interface AgentChatTurnStatus {
    /** The submitted message id. */
    readonly id: string
    /** The queue's stable job id. */
    readonly jobId: string
    /** The conversation to refresh. */
    readonly conversationId: string
    /** Queued, running, succeeded or failed. */
    readonly status: "queued" | "running" | "succeeded" | "failed"
    /** The stored agent answer, or null before it is written. */
    readonly resultMessageId: string | null
    /** A stable failure code, or null. */
    readonly errorCode: string | null
}

/** The agent history list. */
export type AgentChatConversations = ReadonlyArray<ChatConversation>
/** The messages displayed by the thread. */
export type AgentChatMessages = ReadonlyArray<AgentChatMessage>

/** The agent facts not present in the reusable public profile. */
export interface ChatAgentFacts {
    /** The agent. */
    readonly id: string
    /** Its module. */
    readonly module: string
    /** Active or paused. */
    readonly status: string
    /** The opening greeting. */
    readonly greeting: string
    /** The HTTPS address of the agent's picture, or null for the default mascot. */
    readonly avatarUrl: string | null
}

/** The submitted chat message and its stored reply's delivery verdict. */
export interface ChatTurnFacts {
    /** The submitted message. */
    readonly id: string
    /** The containing conversation. */
    readonly conversationId: string
    /** Website threads are delivered by persisting the reply for the page. */
    readonly channel: string
    /** User or agent; agent messages enqueue delivery. */
    readonly role: string
    /** The submitted human reply's delivery verdict. */
    readonly deliveryStatus: string | null
    /** The reply stored for a user message, when any. */
    readonly replyId: string | null
    /** The reply's delivery verdict. */
    readonly replyDeliveryStatus: string | null
}

/** Where the job or wake behind a submitted message stands. */
export interface TurnJobState {
    /** The job or wake. */
    readonly id: string
    /** Waiting, running, done or failed. */
    readonly state: "queued" | "running" | "done" | "failed"
}

/** The state of the job or wake behind a message, or none. */
export type OptionalTurnJobState = TurnJobState | null
