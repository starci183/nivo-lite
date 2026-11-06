import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import type { LeadFlow } from "./lead-flows.contracts"

/** Who a conversation is "handled by" while a person must take over: the bot is silent until they hand it back. */
export const LEAD_GEN_ACTOR = "NIVO · Lead Gen"

/** Who speaks a transcript line. */
export type LineRole = "user" | "agent" | "system"

/** One line of the prospect transcript a flow stores. */
export interface FlowTranscriptLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation, or null when the flow has none (nothing is stored). */
    readonly conversationId: string | null
    /** Who speaks. */
    readonly role: LineRole
    /** The text. */
    readonly body: string
    /** For an agent line: whether Meta accepted it, and why not. */
    readonly delivery: LineDelivery | null
}

/** The delivery verdict of an agent line. */
export interface LineDelivery {
    /** Meta accepted it. */
    readonly sent: boolean
    /** Why it did not go. */
    readonly error: string | null
}

/** The conversation a flow's person is heard in. */
export interface FlowConversationTarget {
    /** The workspace. */
    readonly workspaceId: string
    /** The flow. */
    readonly flow: Pick<LeadFlow, "platform" | "connection_id" | "lead_id" | "name">
    /** The person on the channel: their Messenger / Instagram id, or `comment:<id>` for a comment. */
    readonly externalId: string
    /** The lead_gen agent that speaks in it. */
    readonly agentId: string
}

/** A transcript line stored once per work item, so a retried step finds what it already sent. */
export interface StableLine {
    /** The message id (the work item id). */
    readonly id: string
    /** Meta already accepted it. */
    readonly sent: boolean
}

@Injectable()
/** The transcript of a prospect: the conversation a person can read and take over, and the lead_gen agent that speaks in it. */
export class LeadFlowConversationService {
    constructor(
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentsService,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** The lead_gen agent bound to the connection as a lead source (and allowed to act), else the workspace's first active one. */
    async leadGenAgent(workspaceId: string, connectionId: string | null): Promise<AgentProfile | null> {
        if (connectionId !== null) {
            const [bound] = await this.bindings.agentsFor(connectionId, "lead_source", {
                acting: true,
                modules: ["lead_gen"],
            })
            const profile = bound === undefined ? null : await this.agents.profileOf(workspaceId, bound.id)
            if (profile !== null) return profile
        }
        return this.agents.profileOfDepartment(workspaceId, "lead_gen")
    }

    /** The conversation of the person, created on first contact; it follows the current lead_gen agent and the lead. */
    async ensure(target: FlowConversationTarget): Promise<string | null> {
        const connectionId = target.flow.connection_id
        if (connectionId === null || target.externalId === "") return null
        const met = await this.conversations.meet({
            workspaceId: target.workspaceId,
            agentId: target.agentId,
            channel: target.flow.platform ?? "facebook",
            customerId: target.externalId,
            visitor: target.flow.name ?? "",
            connectionId,
        })
        const { id, leadId } = met.conversation
        if (target.flow.lead_id !== null && leadId === null)
            await this.conversations.attachLead(target.workspaceId, id, target.flow.lead_id)
        return id
    }

    /** Stores one line of the transcript; an empty line or a flow without a conversation stores nothing. */
    async say(line: FlowTranscriptLine): Promise<void> {
        if (line.conversationId === null || line.body.trim() === "") return
        if (line.role === "user") {
            await this.messages.storeCustomer(line.workspaceId, line.conversationId, line.body, null, null)
            return
        }
        if (line.role === "system") {
            await this.messages.storeLine(line.workspaceId, line.conversationId, line.body)
            return
        }
        const stored = await this.messages.storeAgentLine({
            workspaceId: line.workspaceId,
            conversationId: line.conversationId,
            body: line.body,
            key: this.ids.next(),
        })
        if (line.delivery !== null)
            await this.messages.markDelivery(
                line.workspaceId,
                stored.id,
                line.delivery.sent,
                line.delivery.error ?? undefined,
            )
    }

    /** Stores the company line of a work item once, under the item id, and tells whether it already went out. */
    async stableLine(
        workspaceId: string,
        conversationId: string,
        body: string,
        author: string,
        itemId: string,
    ): Promise<StableLine> {
        const stored = await this.messages.storeAgentLine({
            workspaceId,
            conversationId,
            body,
            key: itemId,
            human: { name: author, userId: null },
        })
        return { id: stored.id, sent: stored.sent }
    }

    /** Writes whether Meta accepted a stored line. */
    async markDelivery(workspaceId: string, messageId: string, sent: boolean, error: string | null): Promise<void> {
        await this.messages.markDelivery(workspaceId, messageId, sent, error ?? undefined)
    }

    /** True while a person holds one of the conversations (the bot stays silent); with none to look at, the flow's own state decides. */
    async heldByPerson(
        flow: Pick<LeadFlow, "workspace_id" | "state" | "conversation_id">,
        ...more: Array<string | null>
    ): Promise<boolean> {
        if (flow.state !== "escalated") return false
        const ids = [flow.conversation_id, ...more].filter((id): id is string => id !== null && id !== "")
        if (ids.length === 0) return true
        const held = await Promise.all(
            ids.map(async (id) => {
                const found = await this.conversations.humanOf(flow.workspace_id, id)
                return found !== null && found.handledBy !== null
            }),
        )
        return held.some(Boolean)
    }

    /** A person holds the conversation from now on. */
    async handToPerson(workspaceId: string, conversationId: string): Promise<void> {
        await this.conversations.setHolder(workspaceId, conversationId, LEAD_GEN_ACTOR)
    }
}
