import { Injectable } from "@nestjs/common"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { ThreadMessage, UserPost } from "@modules/domain/thread-messages"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"

@Injectable()
/**
 * Wakes the agents a thread message tags. The tags are the list the author chose, never read from the text, and the right to ask was
 * proved when the message was written. Every wake is keyed by the message, so a retried post wakes nobody twice, and all of them are
 * written in one transaction with their jobs.
 */
export class ThreadTagWakesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly wakes: AgentWakeService,
    ) {}

    /** Wakes each agent the message tags; a message that tags only people and groups wakes nobody. */
    async wake(post: UserPost, message: ThreadMessage): Promise<void> {
        const agentIds = message.mentions.flatMap((mention) => (mention.kind === "agent" ? [mention.id] : []))
        if (agentIds.length === 0) return
        await this.entityManager.transaction((tx) =>
            eachInOrder(agentIds, (agentId) =>
                this.wakes.wake(tx, {
                    workspaceId: post.workspaceId,
                    agentId,
                    source: "tag",
                    eventKey: message.id,
                    context: {
                        threadId: post.threadId,
                        messageId: message.id,
                        authorUserId: post.userId,
                        locale: post.locale,
                    },
                    actorMemberId: message.authorId,
                }),
            ),
        )
    }
}
