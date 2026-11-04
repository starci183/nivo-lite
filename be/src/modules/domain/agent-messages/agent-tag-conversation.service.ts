import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ConversationHandoverService } from "@modules/domain/agent-conversations"
import type { AgentTagNotice, AgentTagVisibilityPort, OptionalSpeaker } from "@modules/domain/agent-work"
import type { AgentDirectoryService } from "@modules/domain/agents"
import { InjectTagAgentDirectory, InjectConversationHandover } from "./agent-messages.decorators"
import { AgentMessagesService } from "./agent-messages.service"

@Injectable()
/**
 * The conversations side of a hand-off between agents: a visible tag line in the conversation ("@Name words") or a silent move of the
 * conversation to the target agent, and the one speaker of the conversation: the agent it is bound to, and the hand-back to the agent that
 * opened the door. Without the handover or the directory bound it shows and moves nothing it cannot name, and knows no speaker.
 */
export class AgentTagConversationService implements AgentTagVisibilityPort {
    constructor(
        private readonly messages: AgentMessagesService,
        @Optional() @InjectConversationHandover() private readonly handover: ConversationHandoverService | null = null,
        @Optional() @InjectTagAgentDirectory() private readonly directory: AgentDirectoryService | null = null,
    ) {}

    /** Writes the tag line between the messages of the conversation; the customer never sees it. */
    async announce(notice: AgentTagNotice, tx: EntityManager): Promise<void> {
        const [target] = (await this.directory?.activeInOrder(notice.workspaceId, [notice.toAgentId], 1)) ?? []
        const mention = target === undefined ? "" : `@${target.name} `
        await this.messages.storeLine(notice.workspaceId, notice.conversationId, `${mention}${notice.text}`.trim(), tx)
    }

    /** The agent that holds the conversation's right to speak; null when a person holds it, or when no handover is bound. */
    holderOf(workspaceId: string, conversationId: string): Promise<OptionalSpeaker> {
        return this.handover === null ? Promise.resolve(null) : this.handover.speakerOf(workspaceId, conversationId)
    }

    /** Gives the conversation back to the agent that opened the door, once the agent that holds it is done. */
    async handBack(workspaceId: string, conversationId: string, fromAgentId: string): Promise<void> {
        await this.handover?.returnToFront(workspaceId, conversationId, fromAgentId)
    }

    /** Moves the conversation to the target agent and leaves no line in it; only an agent can hand a conversation over. */
    async redirect(notice: AgentTagNotice): Promise<void> {
        if (this.handover === null || notice.fromAgentId === null) return
        await this.handover.handOver({
            workspaceId: notice.workspaceId,
            conversationId: notice.conversationId,
            fromAgentId: notice.fromAgentId,
            toAgentId: notice.toAgentId,
            reason: notice.text,
        })
    }
}
