import { Injectable } from "@nestjs/common"
import { AgentTagService } from "@modules/domain/agent-work"
import type { TeamChatTags } from "@modules/domain/team-chat"
import { AgentOwnershipService } from "./agent-ownership.service"

@Injectable()
/**
 * The tag a person writes in the team chat: `@agent` in a message hands the text to that agent through the one tag door, so the wake, its
 * origin and the agent's tag trigger are the door's. The person must be allowed to hand work to the agent (its roles and rooms); the chat never calls
 * the agent itself, the answer comes back as a report.
 */
export class TeamChatTagsService implements TeamChatTags {
    constructor(
        private readonly ownership: AgentOwnershipService,
        private readonly tags: AgentTagService,
    ) {}

    /** Writes the tag wake of one message for one agent; false when the person may not hand work to it or the tag was written before. */
    async handOff(
        workspaceId: string,
        tag: {
            readonly userId: string
            readonly agentId: string
            readonly roomId: string
            readonly messageId: string
            readonly text: string
        },
    ): Promise<boolean> {
        const personId = await this.ownership.memberIdOf(tag.userId, workspaceId)
        if (!(await this.ownership.canAssign(personId, tag.agentId))) return false
        const result = await this.tags.tagAgent({
            workspaceId,
            toAgentId: tag.agentId,
            personId,
            text: tag.text,
            subject: `chat-room:${tag.roomId}`,
            context: { roomId: tag.roomId, messageId: tag.messageId },
            eventKey: `chat-tag:${tag.messageId}:${tag.agentId}`,
        })
        return result.tagged
    }
}
