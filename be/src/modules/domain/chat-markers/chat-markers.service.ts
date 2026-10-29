import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { isOfficeRoomKey, MessageEntity } from "@modules/domain/messages"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import { WorkspaceMemberSeatsService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatMarkerState, ChatOwnMessage, ChatSeenMember, ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersError, ChatMarkersErrorCode } from "./errors/chat-markers.error"
import type { ChatReaderAvatarRow, ChatTargetRow } from "./persistence/chat-markers.rows"
import { ChatMarkerEntity } from "./persistence/entities"

/** The conflict target of a marker: one row per member and target. */
const MARKER_KEY = '("workspace_id", "user_id", "target_key")'

/** Moves the delivered cursor forward only: a row written for an older message never replaces a newer one. */
const DELIVERED_UPSERT = `${MARKER_KEY} DO UPDATE SET "delivered_at" = EXCLUDED."delivered_at", "delivered_message_id" = EXCLUDED."delivered_message_id" WHERE "chat_markers"."delivered_at" IS NULL OR ("chat_markers"."delivered_at", "chat_markers"."delivered_message_id") < (EXCLUDED."delivered_at", EXCLUDED."delivered_message_id")`

/** Moves both cursors forward only, each kept at the newest message it has seen. */
const READ_UPSERT = `${MARKER_KEY} DO UPDATE SET "delivered_at" = GREATEST("chat_markers"."delivered_at", EXCLUDED."delivered_at"), "delivered_message_id" = CASE WHEN "chat_markers"."delivered_at" IS NULL OR ("chat_markers"."delivered_at", "chat_markers"."delivered_message_id") < (EXCLUDED."delivered_at", EXCLUDED."delivered_message_id") THEN EXCLUDED."delivered_message_id" ELSE "chat_markers"."delivered_message_id" END, "read_at" = GREATEST("chat_markers"."read_at", EXCLUDED."read_at"), "read_message_id" = CASE WHEN "chat_markers"."read_at" IS NULL OR ("chat_markers"."read_at", "chat_markers"."read_message_id") < (EXCLUDED."read_at", EXCLUDED."read_message_id") THEN EXCLUDED."read_message_id" ELSE "chat_markers"."read_message_id" END`

/** How many admitted accounts one target lists. */
const MEMBER_IDS_LIMIT = 500

/** How many readers the receipt names; the rest are only counted. */
const SEEN_BY_LIMIT = 3

/** Whether a member's room read cursor passes the message: strictly later, or equal with the precise cursor at or beyond it. */
/** The messages of a direct chat or of an office room, whichever the target names. */
const messagesOf = (manager: EntityManager, conversational: boolean): SelectQueryBuilder<ObjectLiteral> =>
    conversational
        ? manager.createQueryBuilder(AgentMessageEntity, "m")
        : manager.createQueryBuilder(MessageEntity, "m")

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
            .onConflict(DELIVERED_UPSERT)
            .execute()
        await this.activity.receipt(workspaceId, chatActivityTarget(target))
    }

    /** Acknowledges a displayed message; a read cursor also proves delivery and preserves room read compatibility. */
    async markRead(principalId: string, workspaceId: string, target: ChatTarget, messageId: string): Promise<void> {
        const params = await this.receiptParams(principalId, workspaceId, target, messageId)
        await this.entityManager.transaction(async (manager) => {
            await manager
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
                .setParameter("at", params[4])
                .onConflict(READ_UPSERT)
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
    private async ownMessage(
        manager: EntityManager,
        workspaceId: string,
        userId: string,
        target: ChatTarget,
    ): Promise<OwnMessage | null> {
        const read = messagesOf(manager, target.conversationId !== null)
            .select("m.id", "id")
            .addSelect("to_json(m.created_at) #>> '{}'", "createdAt")
        const rows: ReadonlyArray<unknown> = await (
            target.conversationId === null
                ? read
                      .where("m.workspace_id = :workspaceId AND m.author_user_id = :userId", { workspaceId, userId })
                      .andWhere(target.room === null ? "true" : "m.room = :room", { room: target.room })
                : read.where(
                      "m.workspace_id = :workspaceId AND m.conversation_id = :conversationId AND m.author_user_id = :userId",
                      { workspaceId, conversationId: target.conversationId, userId },
                  )
        )
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(1)
            .getRawMany()
        const [row] = rows
        if (typeof row !== "object" || row === null) return null
        const id: unknown = Reflect.get(row, "id")
        const createdAt: unknown = Reflect.get(row, "createdAt")
        return typeof id === "string" && typeof createdAt === "string" ? { id, createdAt } : null
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
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder()
            .select("rd.user_id", "userId")
            .from("public.office_rooms_reads", "rd")
            .leftJoin(
                ChatMarkerEntity,
                "exact",
                "exact.workspace_id = rd.workspace_id AND exact.user_id = rd.user_id AND exact.conversation_id IS NULL AND exact.room = rd.room",
            )
            .where("rd.workspace_id = :workspaceId AND rd.user_id IN (:...userIds)", cursor)
            .andWhere("rd.room = COALESCE(:room::text, '')", { room: target.room })
            .andWhere(
                `(rd.last_read_at > :createdAt::timestamptz OR (rd.last_read_at = :createdAt::timestamptz
                    AND (exact.read_at IS DISTINCT FROM rd.last_read_at OR exact.read_message_id >= :ownId::uuid)))`,
                cursor,
            )
            .limit(userIds.length)
            .getRawMany()
        return userIdsOf(rows)
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
        const read = messagesOf(this.entityManager, target.conversationId !== null).select(
            "to_json(m.created_at) #>> '{}'",
            "createdAt",
        )
        const rows: ReadonlyArray<unknown> =
            target.conversationId === null
                ? await read
                      .where("m.workspace_id = :workspaceId AND m.id = :messageId", { workspaceId, messageId })
                      .andWhere(target.room === null ? "true" : "m.room = :room", { room: target.room })
                      .limit(1)
                      .getRawMany()
                : await read
                      .where(
                          "m.workspace_id = :workspaceId AND m.conversation_id = :conversationId AND m.id = :messageId",
                          {
                              workspaceId,
                              conversationId: target.conversationId,
                              messageId,
                          },
                      )
                      .limit(1)
                      .getRawMany()
        const created = rows.map((row): unknown =>
            typeof row === "object" && row !== null ? Reflect.get(row, "createdAt") : null,
        )
        return created.find((value): value is string => typeof value === "string")
    }
}
