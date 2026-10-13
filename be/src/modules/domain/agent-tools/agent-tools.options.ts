import type { InjectionToken, Type } from "@nestjs/common"
import type { BookingTools, ConversationLeads, HandoffTool, KnowledgeSearch, LeadWriter } from "./agent-tools.port"

/** The owners of the ports the tools reach through: the app root names a class for each one. */
export interface AgentToolsPorts {
    /** Searches the public business knowledge (the knowledge lane). */
    readonly knowledgeSearch: Type<KnowledgeSearch>
    /** Writes the lead an agent captured (the leads side of the gate). */
    readonly leadWriter: Type<LeadWriter>
    /** Runs the booking tools (the booking lane). */
    readonly bookingTools: Type<BookingTools>
    /** Provider that asks the owner to approve an answer (the work engine). */
    readonly approvalRequester: InjectionToken
    /** Hands a conversation to a person (the channels lane). */
    readonly handoffTool: Type<HandoffTool>
    /** Finds the lead of a conversation (the channels lane). */
    readonly conversationLeads: Type<ConversationLeads>
    /** Provider that mints and verifies tool tokens (OpenClaw). */
    readonly toolTokens: InjectionToken
}

/** What the agent tools capability needs from the app root. */
export interface AgentToolsOptions {
    /** The owners of its ports. */
    readonly ports: AgentToolsPorts
}
