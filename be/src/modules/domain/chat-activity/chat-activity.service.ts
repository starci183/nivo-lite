import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectAfterCommit, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AfterCommit } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatActivityLogEvent } from "./chat-activity.log-events"
import type { AuthorId, ChatActivityFrame, ChatActivityKind } from "./chat-activity.contracts"
import { chatActivityTopic } from "./chat-activity.policy"

/** The most active members one push reaches. */
const MEMBER_LIMIT = 500

/** One active member of a workspace: the account id the member's topic is built from. */
interface ActiveMember {
    /** The account id. */
    readonly userId: string
}

/** True when a row names the account of an active member. */
const isActiveMember = (value: unknown): value is ActiveMember =>
    typeof value === "object" && value !== null && "userId" in value && typeof value.userId === "string"

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
    ) {}

    /** A line arrived in a target: every active member is told, and every member but its author has more unread. */
    message(
        workspaceId: string,
        roomOrConversation: string,
        authorId: AuthorId,
        manager?: EntityManager,
    ): Promise<void> {
        return this.announce(workspaceId, manager, async (recipients) => {
            await this.push(workspaceId, recipients, "message", roomOrConversation)
            await this.push(
                workspaceId,
                recipients.filter((id) => id !== authorId),
                "unread",
                roomOrConversation,
            )
        })
    }

    /** A delivered or seen cursor moved: every active member is told, because each shows who has seen a line. */
    receipt(workspaceId: string, roomOrConversation: string, manager?: EntityManager): Promise<void> {
        return this.announce(workspaceId, manager, (recipients) =>
            this.push(workspaceId, recipients, "receipt", roomOrConversation),
        )
    }

    /** One member's unread counts or room list changed (they read a target): only that member is told. */
    unread(workspaceId: string, roomOrConversation: string, memberId: string, manager?: EntityManager): Promise<void> {
        return this.announce(workspaceId, manager, (recipients) =>
            this.push(
                workspaceId,
                recipients.filter((id) => id === memberId),
                "unread",
                roomOrConversation,
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
                const rows: ReadonlyArray<unknown> = await this.entityManager
                    .createQueryBuilder(WorkspaceMemberEntity, "m")
                    .select("m.user_id", "userId")
                    .where("m.workspace_id = :workspaceId AND m.status = 'active'", { workspaceId })
                    .limit(MEMBER_LIMIT)
                    .getRawMany()
                await deliver(rows.filter(isActiveMember).map((row) => row.userId))
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
        roomOrConversation: string,
    ): Promise<void> {
        const at = this.clock.now().toISOString()
        await Promise.all(
            recipients.map((recipientId) => {
                const frame: ChatActivityFrame = { id: `${kind}:${this.ids.next()}`, kind, roomOrConversation, at }
                return this.hub.publish(chatActivityTopic(recipientId, workspaceId), frame)
            }),
        )
    }
}
