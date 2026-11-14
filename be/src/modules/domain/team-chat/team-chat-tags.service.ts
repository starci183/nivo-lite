import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentOwnershipService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import { TEAM_CHAT_TAG_QUEUE, TeamChatTagJob, teamChatTagKeyOf, type TeamChatTagPayload } from "@modules/queues/team-chat-tag"
import type { TeamChatTag, TeamChatTags } from "./team-chat.port"

@Injectable()
/**
 * The tag a person writes in the team chat: `@agent` in a message hands the text to that agent. The person must be allowed to hand work to
 * the agent (its roles and rooms); the tag is then queued once per (message, agent) for the api, which delivers it through the one event
 * pipeline (`TeamChatTagDeliveryService`): the app the message was posted in (the api, or the mcp gateway) composes no delivery and drives
 * no run (R24). The chat never calls the agent itself, the answer comes back as a report.
 */
export class TeamChatTagsService implements TeamChatTags {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly ownership: AgentOwnershipService,
    ) {}

    /** Queues the tag of one message for one agent; false when the person may not hand work to it. A repeat is the same job. */
    async handOff(workspaceId: string, tag: TeamChatTag): Promise<boolean> {
        const personId = await this.ownership.memberIdOf(tag.userId, workspaceId)
        if (!(await this.ownership.canAssign(personId, tag.agentId))) return false
        const payload: TeamChatTagPayload = {
            workspaceId,
            agentId: tag.agentId,
            memberId: personId,
            roomId: tag.roomId,
            messageId: tag.messageId,
            text: tag.text,
        }
        await this.entityManager.transaction((tx: EntityManager) =>
            this.outbox.write(tx, TEAM_CHAT_TAG_QUEUE, payload, {
                job: TeamChatTagJob.Deliver,
                dedupeKey: teamChatTagKeyOf(tag.messageId, tag.agentId),
            }),
        )
        return true
    }
}
