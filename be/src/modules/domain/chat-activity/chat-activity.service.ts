import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectAfterCommit, InjectPrimaryEntityManager, type AfterCommit } from "@modules/platform/database"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectRealtimeHub, type RealtimeHub } from "@modules/platform/realtime"
import { ChatActivityLogEvent } from "./chat-activity.log-events"
import type { AuthorId, ChatActivityFrame, ChatActivityKind } from "./chat-activity.contracts"
import { chatActivityTopic } from "./chat-activity.policy"

/** The most active members one push reaches. */
const MEMBER_LIMIT = 500

@Injectable()
/**
 * Tells the connected members of a workspace that a chat changed. The writers call it after they stored the change; a push that
 * fails is logged and never fails the stored change, because every client refetches its snapshot when its stream reopens.
 */
export class ChatActivityService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
        @InjectAfterCommit() private readonly commits: AfterCommit,
        private readonly seats: WorkspaceMemberSeatsService,
    ) {}

    /** A line arrived in a target: every active member is told, and every member but its author has more unread. */
    message(workspaceId: string, roomId: string, authorId: AuthorId, manager?: EntityManager): Promise<void> {
        return this.announce(workspaceId, manager, async (recipients) => {
            await this.push(workspaceId, recipients, "message", roomId)
            await this.push(
                workspaceId,
                recipients.filter((id) => id !== authorId),
                "unread",
                roomId,
            )
        })
    }

    /** A delivered or seen cursor moved: every active member is told, because each shows who has seen a line. */
    receipt(workspaceId: string, roomId: string, manager?: EntityManager): Promise<void> {
        return this.announce(workspaceId, manager, (recipients) =>
            this.push(workspaceId, recipients, "receipt", roomId),
        )
    }

    /** One member's unread counts or room list changed (they read a target): only that member is told. */
    unread(workspaceId: string, roomId: string, memberId: string, manager?: EntityManager): Promise<void> {
        return this.announce(workspaceId, manager, (recipients) =>
            this.push(
                workspaceId,
                recipients.filter((id) => id === memberId),
                "unread",
                roomId,
            ),
        )
    }

    private async announce(
        workspaceId: string,
        manager: EntityManager | undefined,
        deliver: (recipients: ReadonlyArray<string>) => Promise<void>,
    ): Promise<void> {
        const task = async (): Promise<void> => {
            try {
                const users = await this.seats.activeUsers(workspaceId, MEMBER_LIMIT)
                await deliver(users.map((user) => user.userId))
            } catch (cause) {
                this.logger.error(ChatActivityLogEvent.PublishFailed, cause, { workspaceId })
            }
        }
        await this.commits.run(manager ?? this.entityManager, task)
    }

    private async push(
        workspaceId: string,
        recipients: ReadonlyArray<string>,
        kind: ChatActivityKind,
        roomId: string,
    ): Promise<void> {
        const at = this.clock.now().toISOString()
        await Promise.all(
            recipients.map((recipientId) => {
                const frame: ChatActivityFrame = { id: `${kind}:${this.ids.next()}`, kind, roomId, at }
                return this.hub.publish(chatActivityTopic(recipientId, workspaceId), frame)
            }),
        )
    }
}
