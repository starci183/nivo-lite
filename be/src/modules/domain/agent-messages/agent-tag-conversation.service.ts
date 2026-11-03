import { Inject, Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConversationHandoverService } from "@modules/domain/agent-conversations"
import type { AgentTagNotice, AgentTagVisibilityPort } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentMessagesService } from "./agent-messages.service"

@Injectable()
/**
 * The conversations side of a hand-off between agents: a visible tag line in the conversation ("@Name words") or a silent move of the
 * conversation to the target agent. Without the handover or the directory bound it shows and moves nothing it cannot name.
 */
export class AgentTagConversationService implements AgentTagVisibilityPort {
    constructor(
        private readonly messages: AgentMessagesService,
        @Optional()
        @Inject(ConversationHandoverService)
        private readonly handover: ConversationHandoverService | null = null,
        @Optional() @Inject(AgentDirectoryService) private readonly directory: AgentDirectoryService | null = null,
    ) {}

    /** Writes the tag line between the messages of the conversation; the customer never sees it. */
    async announce(notice: AgentTagNotice, tx: EntityManager): Promise<void> {
        const [target] = (await this.directory?.activeInOrder(notice.workspaceId, [notice.toAgentId], 1)) ?? []
        const mention = target === undefined ? "" : `@${target.name} `
        await this.messages.storeLine(notice.workspaceId, notice.conversationId, `${mention}${notice.text}`.trim(), tx)
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
