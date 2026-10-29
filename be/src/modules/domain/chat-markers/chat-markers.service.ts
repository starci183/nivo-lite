import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { AgentMessageCursorsService } from "@modules/domain/agent-messages"
import { isOfficeRoomKey, MessageCursorsService } from "@modules/domain/messages"
import { OfficeReadMarkersService, OfficeRoomReadersService } from "@modules/domain/office-rooms"
import type { RoomReaderStanding } from "@modules/domain/office-rooms"
import { WorkspaceMemberSeatsService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatMarkerState, ChatOwnMessage, ChatSeenMember, ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersError, ChatMarkersErrorCode } from "./errors/chat-markers.error"
import type { ChatReaderAvatarRow, ChatTargetRow } from "./persistence/chat-markers.rows"
import { ChatMarkerEntity } from "./persistence/entities"

/** The conflict target of a marker: one row per member and target. */
const MARKER_KEY = ["workspace_id", "user_id", "target_key"]

/** Moves the delivered cursor forward only: a row written for an older message never replaces a newer one. */
const DELIVERED_AHEAD =
    "chat_markers.delivered_at IS NULL OR (chat_markers.delivered_at, chat_markers.delivered_message_id) < (EXCLUDED.delivered_at, EXCLUDED.delivered_message_id)"

/** Moves the read cursor forward only, kept at the newest message it has seen. */
const READ_AHEAD =
    "chat_markers.read_at IS NULL OR (chat_markers.read_at, chat_markers.read_message_id) < (EXCLUDED.read_at, EXCLUDED.read_message_id)"

/** How many admitted accounts one target lists. */
const MEMBER_IDS_LIMIT = 500

/** How many readers the receipt names; the rest are only counted. */
const SEEN_BY_LIMIT = 3

/** The most other active members one receipt weighs. */
const RECEIPT_MEMBER_LIMIT = 500

/** The account ids a cursor query returned. */
const userIdsOf = (rows: ReadonlyArray<unknown>): Set<string> =>
    new Set(rows.map((row) => String(Reflect.get(Object(row), "userId"))))

/** The newest authored message of the caller: its id and its creation instant as the database words it. */
interface OwnMessage {
    /** The message id. */
    readonly id: string
    /** The creation instant, in the database's own text, so no precision is lost. */
    readonly createdAt: string
}

@Injectable()
/** Authenticated per-member chat receipts; marker cursors never include a message newer than the acknowledged fetch. */
export class ChatMarkersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly roomReads: OfficeReadMarkersService,
        private readonly activity: ChatActivityService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly roomMessages: MessageCursorsService,
        private readonly conversationMessages: AgentMessageCursorsService,
        private readonly roomReaders: OfficeRoomReadersService,
    ) {}

    /** The same target admission used by receipt writes and typing broadcasts. */
    async requireTarget(principalId: string, workspaceId: string, target: ChatTarget): Promise<WorkspaceMember> {
        const member = await this.members.require(principalId, workspaceId)
        if (target.room !== null && (target.conversationId !== null || !isOfficeRoomKey(target.room)))
            throw new ChatMarkersError({ code: ChatMarkersErrorCode.TargetNotFound })
        const [row] = await callDbFunction<ChatTargetRow>(this.entityManager, "be_access.chat_target_member", [
            workspaceId,
            member.userId,
            target.room,
            target.conversationId,
        ])
        if (row?.chat_target_member !== true) throw new ChatMarkersError({ code: ChatMarkersErrorCode.TargetNotFound })
        return member
    }

    /** The ids of every active account admitted to the target, after proving the caller is one of them. */
    async memberIds(principalId: string, workspaceId: string, target: ChatTarget): Promise<Array<string>> {
        await this.requireTarget(principalId, workspaceId, target)
        const users = await this.seats.activeUsers(workspaceId, MEMBER_IDS_LIMIT)
        return users.map((user) => user.userId)
    }

    /** The preference and receipt beneath this account's newest authored message. */
    async state(principalId: string, workspaceId: string, target: ChatTarget): Promise<ChatMarkerState> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        return this.entityManager.transaction(async (manager) => {
            const marker = await manager.findOne(ChatMarkerEntity, {
                where: { workspaceId, userId: member.userId, targetKey: target.conversationId ?? target.room ?? "" },
                select: { muted: true },
            })
            const own = await this.ownMessage(manager, workspaceId, member.userId, target)
            return {
                muted: marker?.muted ?? false,
                lastOwnMessage:
                    own === null ? null : await this.receipt(manager, workspaceId, member.userId, target, own),
            }
        })
    }

    /** Acknowledges the newest message a client actually fetched, independently of whether it displayed it. */
    async markDelivered(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        messageId: string,
    ): Promise<void> {
        const params = await this.receiptParams(principalId, workspaceId, target, messageId)
        await this.entityManager
            .createQueryBuilder(ChatMarkerEntity, "chat_markers")
            .insert()
            .values({
                workspaceId: params[0],
                userId: params[1],
                room: params[2],
                conversationId: params[3],
                deliveredAt: () => ":at::timestamptz",
                deliveredMessageId: params[5],
            })
            .setParameter("at", params[4])
            .orUpdate(["delivered_at", "delivered_message_id"], MARKER_KEY, {
                overwriteCondition: { where: DELIVERED_AHEAD },
            })
            .execute()
        await this.activity.receipt(workspaceId, chatActivityTarget(target))
    }

    /** Acknowledges a displayed message; a read cursor also proves delivery and preserves room read compatibility. */
    async markRead(principalId: string, workspaceId: string, target: ChatTarget, messageId: string): Promise<void> {
        const params = await this.receiptParams(principalId, workspaceId, target, messageId)
        await this.entityManager.transaction(async (manager) => {
            const insert = () =>
                manager
                    .createQueryBuilder(ChatMarkerEntity, "chat_markers")
                    .insert()
                    .values({
                        workspaceId: params[0],
                        userId: params[1],
                        room: params[2],
                        conversationId: params[3],
                        deliveredAt: () => ":at::timestamptz",
                        deliveredMessageId: params[5],
                        readAt: () => ":at::timestamptz",
                        readMessageId: params[5],
                    })
            await insert()
                .setParameter("at", params[4])
                .orUpdate(["delivered_at", "delivered_message_id"], MARKER_KEY, {
                    overwriteCondition: { where: DELIVERED_AHEAD },
                })
                .execute()
            await insert()
                .setParameter("at", params[4])
                .orUpdate(["read_at", "read_message_id"], MARKER_KEY, { overwriteCondition: { where: READ_AHEAD } })
                .execute()
            if (target.conversationId === null)
                await this.roomReads.advance(workspaceId, params[1], target.room ?? "", params[4], manager)
        })
        await this.activity.receipt(workspaceId, chatActivityTarget(target))
        await this.activity.unread(workspaceId, chatActivityTarget(target), params[1])
    }

    /** Changes only the proven caller's preference for this target. */
    async mute(principalId: string, workspaceId: string, target: ChatTarget, muted: boolean): Promise<void> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        await this.entityManager
            .createQueryBuilder(ChatMarkerEntity, "chat_markers")
            .insert()
            .values({
                workspaceId,
                userId: member.userId,
                room: target.room ?? "",
                conversationId: target.conversationId,
                muted,
            })
            .orUpdate(["muted"], ["workspace_id", "user_id", "target_key"])
            .execute()
        await this.activity.unread(workspaceId, chatActivityTarget(target), member.userId)
    }

    /** The caller's newest authored message in the target, or null before any. */
    private ownMessage(
        manager: EntityManager,
        workspaceId: string,
        userId: string,
        target: ChatTarget,
    ): Promise<OwnMessage | null> {
        return target.conversationId === null
            ? this.roomMessages.newestAuthored(workspaceId, userId, target.room, manager)
            : this.conversationMessages.newestAuthored(workspaceId, userId, target.conversationId, manager)
    }

    /** The receipt beneath one message: seen by active readers, else delivered to another member, else sent. */
    private async receipt(
        manager: EntityManager,
        workspaceId: string,
        userId: string,
        target: ChatTarget,
        own: OwnMessage,
    ): Promise<ChatOwnMessage> {
        const others = (await this.seats.activeUsers(workspaceId, RECEIPT_MEMBER_LIMIT, manager)).filter(
            (user) => user.userId !== userId,
        )
        const passed = await this.readerIds(
            manager,
            workspaceId,
            others.map((user) => user.userId),
            target,
            own,
        )
        const everyReader = others.filter((user) => passed.has(user.userId))
        const readers = everyReader.slice(0, SEEN_BY_LIMIT).map((user) => ({ id: user.userId, name: user.displayName }))
        const [first] = readers
        if (first === undefined) {
            const delivered = await this.delivered(
                manager,
                workspaceId,
                others.map((user) => user.userId),
                target,
                own,
            )
            return { id: own.id, status: delivered ? "delivered" : "sent", seenBy: [], seenByCount: 0 }
        }
        const avatars = await callDbFunction<ChatReaderAvatarRow>(manager, "be_access.workspace_member_avatars", [
            workspaceId,
            readers.map((reader) => reader.id),
        ])
        const seenBy = readers.map((reader): ChatSeenMember => ({
            id: reader.id,
            name: reader.name,
            avatarSeed: reader.id,
            avatarUrl: avatars.find((avatar) => avatar.id === reader.id)?.avatar_url ?? null,
        }))
        return { id: own.id, status: "seen", seenBy, seenByCount: everyReader.length }
    }

    /** Which of the given accounts have a read cursor that reaches the message, in the room or the conversation of the target. */
    private async readerIds(
        manager: EntityManager,
        workspaceId: string,
        userIds: ReadonlyArray<string>,
        target: ChatTarget,
        own: OwnMessage,
    ): Promise<Set<string>> {
        if (userIds.length === 0) return new Set()
        const cursor = { workspaceId, userIds: [...userIds], createdAt: own.createdAt, ownId: own.id }
        if (target.conversationId !== null) {
            const rows: ReadonlyArray<unknown> = await manager
                .createQueryBuilder(ChatMarkerEntity, "s")
                .select("s.user_id", "userId")
                .where("s.workspace_id = :workspaceId AND s.user_id IN (:...userIds)", cursor)
                .andWhere("s.conversation_id = :conversationId::uuid", { conversationId: target.conversationId })
                .andWhere("(s.read_at, s.read_message_id) >= (:createdAt::timestamptz, :ownId::uuid)", cursor)
                .limit(userIds.length)
                .getRawMany()
            return userIdsOf(rows)
        }
        const standings = await this.roomReaders.readersAt(workspaceId, target.room, userIds, own.createdAt, manager)
        const passed = new Set(
            standings.filter((one: RoomReaderStanding) => one.standing === "later").map((one) => one.userId),
        )
        const level = standings.filter((one) => one.standing === "equal").map((one) => one.userId)
        if (level.length === 0) return passed
        // A marker exactly on the instant passes only when the precise cursor is at or beyond the message.
        const behind: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(ChatMarkerEntity, "s")
            .select("s.user_id", "userId")
            .where("s.workspace_id = :workspaceId AND s.user_id IN (:...level)", { workspaceId, level })
            .andWhere("s.conversation_id IS NULL AND s.room = COALESCE(:room::text, '')", { room: target.room })
            .andWhere(
                "s.read_at = :createdAt::timestamptz AND NOT COALESCE(s.read_message_id >= :ownId::uuid, false)",
                {
                    createdAt: own.createdAt,
                    ownId: own.id,
                },
            )
            .limit(level.length)
            .getRawMany()
        const held = userIdsOf(behind)
        return new Set([...passed, ...level.filter((userId) => !held.has(userId))])
    }

    /** Whether the delivered cursor of any of the given accounts already reaches the message. */
    private async delivered(
        manager: EntityManager,
        workspaceId: string,
        userIds: ReadonlyArray<string>,
        target: ChatTarget,
        own: OwnMessage,
    ): Promise<boolean> {
        if (userIds.length === 0) return false
        const rows = await manager
            .createQueryBuilder(ChatMarkerEntity, "s")
            .select("1", "one")
            .where("s.workspace_id = :workspaceId AND s.user_id IN (:...userIds) AND s.target_key = :targetKey", {
                workspaceId,
                userIds: [...userIds],
                targetKey: target.conversationId ?? target.room ?? "",
            })
            .andWhere("(s.delivered_at, s.delivered_message_id) >= (:createdAt::timestamptz, :ownId::uuid)", {
                createdAt: own.createdAt,
                ownId: own.id,
            })
            .limit(1)
            .getRawMany()
        return rows.length > 0
    }

    private async receiptParams(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        messageId: string,
    ): Promise<[string, string, string, string | null, string, string]> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        const created = await this.createdAtOf(workspaceId, target, messageId)
        if (created === undefined) throw new ChatMarkersError({ code: ChatMarkersErrorCode.MessageNotFound })
        return [workspaceId, member.userId, target.room ?? "", target.conversationId, created, messageId]
    }

    /** The creation instant, as the database words it, of a message inside the proven target; undefined when the target holds no such message. */
    private async createdAtOf(workspaceId: string, target: ChatTarget, messageId: string): Promise<string | undefined> {
        const created =
            target.conversationId === null
                ? await this.roomMessages.createdAtOf(workspaceId, target.room, messageId)
                : await this.conversationMessages.createdAtOf(workspaceId, target.conversationId, messageId)
        return created ?? undefined
    }
}
