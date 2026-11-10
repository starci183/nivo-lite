import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ChatRoomMessageReactionEntity } from "./persistence/entities"
import type { ChatRoomMessageEntity } from "./persistence/entities"
import { MEMBERS_MAX } from "./team-chat.contracts"
import type { ChatMemberRef } from "./team-chat.contracts"
import { COUNT_MAX, REACTION_EMOJI } from "./team-chat-reaction.policy"
import type { OptionalHeld, ReactionHeld, ReactionRow } from "./team-chat-reaction.contracts"

/** The milliseconds since a row last changed, by the database clock. */
const IDLE_MS = "(extract(epoch FROM (now() - r.updated_at)) * 1000)"

/** The count that grows by the taps and stops at the bound. */
const GROWN_COUNT = (): string => `LEAST(count + :taps, ${COUNT_MAX})`

/** What the held-taps query answers: the count and the idle time as the database printed them. */
interface HeldRow {
    /** The taps so far. */
    readonly count: number
    /** Milliseconds since the last tap, as numeric text. */
    readonly idle_ms: string
}

@Injectable()
/** Every read and write of the reaction table of the team chat; the services above it decide who may tap and how many taps count. */
export class TeamChatReactionStoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** What the member already tapped of one emoji on one message; null when they never tapped it. */
    async heldOf(messageId: string, member: ChatMemberRef, emoji: string): Promise<OptionalHeld> {
        const row = await this.entityManager
            .createQueryBuilder(ChatRoomMessageReactionEntity, "r")
            .select("r.count", "count")
            .addSelect(IDLE_MS, "idle_ms")
            .where(
                "r.message_id = :messageId AND r.member_kind = :kind AND r.member_id = :memberId AND r.emoji = :emoji",
                {
                    messageId,
                    kind: member.memberKind,
                    memberId: member.memberId,
                    emoji,
                },
            )
            .getRawOne<HeldRow>()
        return row === undefined ? null : this.heldOfRow(row)
    }

    /**
     * Adds taps to the member's count of one emoji on one message: the first tap makes the row, a later one grows it, and the total
     * stops at the bound. Two first taps at once make one row: the one that lost the race grows it.
     */
    async addTaps(message: ChatRoomMessageEntity, member: ChatMemberRef, emoji: string, taps: number): Promise<void> {
        const made = await this.entityManager
            .createQueryBuilder(ChatRoomMessageReactionEntity, "r")
            .insert()
            .into(ChatRoomMessageReactionEntity)
            .values({
                messageId: message.id,
                roomId: message.roomId,
                workspaceId: message.workspaceId,
                memberKind: member.memberKind,
                memberId: member.memberId,
                emoji,
                count: taps,
            })
            .orIgnore()
            .returning("message_id")
            .execute()
        if (Array.isArray(made.raw) && made.raw.length > 0) return
        await this.entityManager
            .createQueryBuilder(ChatRoomMessageReactionEntity, "r")
            .update(ChatRoomMessageReactionEntity)
            .set({ count: GROWN_COUNT })
            .where("message_id = :messageId AND member_kind = :kind AND member_id = :memberId AND emoji = :emoji", {
                messageId: message.id,
                kind: member.memberKind,
                memberId: member.memberId,
                emoji,
            })
            .setParameter("taps", taps)
            .execute()
    }

    /** The reaction rows of the given messages, at most the member bound of each message for each emoji of the picker. */
    async rowsAmong(messageIds: ReadonlyArray<string>): Promise<Array<ReactionRow>> {
        if (messageIds.length === 0) return []
        const rows = await this.entityManager.find(ChatRoomMessageReactionEntity, {
            where: { messageId: In([...messageIds]) },
            take: messageIds.length * MEMBERS_MAX * REACTION_EMOJI.length,
        })
        return rows.map((row) => ({
            messageId: row.messageId,
            memberKind: row.memberKind,
            memberId: row.memberId,
            emoji: row.emoji,
            count: row.count,
        }))
    }

    private heldOfRow(row: HeldRow): ReactionHeld {
        return { count: Number(row.count), idleMs: Number(row.idle_ms) }
    }
}
