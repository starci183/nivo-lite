import { Injectable, Optional } from "@nestjs/common"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphConversationHoldsService } from "./agent-graph-conversation-holds.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** Which hold of a conversation a person hands back: a person's take-over, an agent's consult hold, or both. */
export type ReleaseHold = "person" | "agent" | "both"

/**
 * What handing a conversation back did: `released` (at least one hold went; `person` names who had taken it over, `agentId` the agent
 * whose consult hold went), `nothing_held` (no person and no agent held it), `not_found` (no such conversation in the workspace).
 */
export interface ConversationRelease {
    /** How it ended. */
    readonly outcome: "released" | "nothing_held" | "not_found"
    /** The person whose take-over was cleared, or null. */
    readonly person: string | null
    /** The agent whose consult hold was cleared, or null. */
    readonly agentId: string | null
}

@Injectable()
/**
 * Hands a conversation back ("hand back to the agent"): clears the hold of a person who took it over (`handledBy`, set by a stop's take-over
 * or a freeze's), through the conversation's own writer, and the consult hold of an agent that keeps it between turns, through
 * `AgentGraphConversationHoldsService.free` (the engine's own release, so nobody mirrors it in SQL). The front door then serves the
 * customer's next line as usual. It decides nothing about a stop: an open stop is still answered at its own door. The caller has
 * proved the person may (owner or manager).
 */
export class AgentGraphConversationReleaseService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly holds: AgentGraphConversationHoldsService,
        @Optional() private readonly conversations?: ChatConversationsService,
    ) {}

    /** Clears the holds asked for; each is cleared only when it stands, so a repeat is `nothing_held`. */
    async release(workspaceId: string, conversationId: string, hold: ReleaseHold): Promise<ConversationRelease> {
        const human = await this.conversations?.humanOf(workspaceId, conversationId)
        if (human === null) return { outcome: "not_found", person: null, agentId: null }
        const person = hold === "agent" ? null : (human?.handledBy ?? null)
        if (person !== null) await this.conversations?.setHolder(workspaceId, conversationId, null)
        const kept = hold === "person" ? null : await this.holds.holderOf(workspaceId, conversationId)
        if (kept !== null) await this.holds.free(workspaceId, conversationId, kept.agentId)
        const agentId = kept?.agentId ?? null
        if (person === null && agentId === null) return { outcome: "nothing_held", person: null, agentId: null }
        this.logger.info(AgentGraphsLogEvent.ConversationReleased, { conversationId, person: person !== null, agentId })
        return { outcome: "released", person, agentId }
    }
}
