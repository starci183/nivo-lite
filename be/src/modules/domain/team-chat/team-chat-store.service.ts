import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, returnedIdRows } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity } from "./persistence/entities"
import { MEMBERS_MAX, ROOMS_MAX } from "./team-chat.contracts"
import type { ChatMemberRef, MessageRef, RoomRole, RoomUnread } from "./team-chat.contracts"
import { isUniqueViolation } from "./team-chat.policy"
import type { ThreadPosition } from "./team-chat.policy"
import type {
    CardKind,
    NewCard,
    NewLine,
    NewRoom,
    NewText,
    OptionalCard,
    OptionalId,
    OptionalPosition,
    RoomFilter,
    UnreadRow,
} from "./team-chat-store.contracts"

/** The database clock as an insert value: every instant of the chat is the database's, so read positions and messages compare on one clock. */
const DATABASE_NOW = (): string => "now()"

/** The read position that moves to the moment of the call. */
const READ_TO_NOW = (): string => "GREATEST(last_read_at, now())"

/** The read position that moves to the moment of one message, microsecond exact. */
const READ_TO_MESSAGE = (): string =>
    "GREATEST(last_read_at, (SELECT created_at FROM public.chat_room_messages WHERE id = :messageId))"

/** The microsecond text of the creation instant of a message, so a thread cursor is exact. */
const CREATED_AT_MICROS = `to_char(msg.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

/** The condition that is true for the messages that are pinned. */
const IS_PINNED = "EXISTS (SELECT 1 FROM public.chat_room_pins p WHERE p.message_id = msg.id)"

/** The condition that is true for the rooms the other member sits in, the viewer aside. */
const HAS_OTHER_MEMBER =
    "EXISTS (SELECT 1 FROM public.chat_room_members w WHERE w.room_id = room.id AND w.member_id = :member AND w.member_id <> :viewerId)"

/** The condition that is true for the rooms the viewer sits in as a person. */
const HAS_VIEWER =
    "EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id = room.id AND m.member_kind = 'user' AND m.member_id = :viewerId)"

/** The key and the content a card keeps its engine object under. */
interface CardRef {
    /** The key of the reference inside the `ref` column. */
    readonly key: "run_id" | "decision_id"
    /** The reference as the column stores it. */
    readonly ref: MessageRef
}

const cardRefOf = (kind: CardKind, refId: string): CardRef =>
    kind === "report" ? { key: "run_id", ref: { run_id: refId } } : { key: "decision_id", ref: { decision_id: refId } }

/** A room row, or none. */
export type OptionalRoom = ChatRoomEntity | null
/** A room member row, or none. */
export type OptionalRoomMember = ChatRoomMemberEntity | null
/** A message row, or none. */
export type OptionalMessage = ChatRoomMessageEntity | null

@Injectable()
/**
 * Every read and write of the four tables of the team chat. The services above it decide who may do what and shape what a screen
 * sees; this one only states the statements, each bounded, so no other file of the capability holds SQL or an entity manager.
 */
export class TeamChatStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** One room of the workspace; null when it is absent or belongs to another workspace. */
    roomById(workspaceId: string, roomId: string): Promise<OptionalRoom> {
        return this.entityManager.findOne(ChatRoomEntity, { where: { id: roomId, workspaceId } })
    }

    /** One room of the workspace that must exist; a missing room is a failure of the caller's own invariant. */
    roomOrFail(workspaceId: string, roomId: string): Promise<ChatRoomEntity> {
        return this.entityManager.findOneOrFail(ChatRoomEntity, { where: { id: roomId, workspaceId } })
    }

    /** The rooms of the workspace among the given ids; an id of another workspace is absent. */
    roomsByIds(workspaceId: string, roomIds: ReadonlyArray<string>): Promise<Array<ChatRoomEntity>> {
        return this.entityManager.find(ChatRoomEntity, {
            where: { id: In([...roomIds]), workspaceId },
            take: roomIds.length,
        })
    }

    /** The direct room of a pair; null when the pair has none. */
    roomByDirectKey(workspaceId: string, directKey: string): Promise<OptionalRoom> {
        return this.entityManager.findOne(ChatRoomEntity, { where: { workspaceId, directKey } })
    }

    /** The rooms of the workspace the filter keeps, by position, at most the bound of a list. */
    rooms(workspaceId: string, filter: RoomFilter): Promise<Array<ChatRoomEntity>> {
        return this.entityManager
            .createQueryBuilder(ChatRoomEntity, "room")
            .where("room.workspace_id = :workspaceId", { workspaceId })
            .andWhere(filter.kind === null ? "TRUE" : "room.kind = :kind", { kind: filter.kind })
            .andWhere(filter.member === null ? "TRUE" : HAS_OTHER_MEMBER, {
                member: filter.member,
                viewerId: filter.viewerId,
            })
            .andWhere(filter.owner ? "TRUE" : HAS_VIEWER, { viewerId: filter.viewerId })
            .orderBy("room.position", "ASC")
            .addOrderBy("room.id", "ASC")
            .take(ROOMS_MAX)
            .getMany()
    }

    /** Opens a room with its members in one transaction; two people opening the same direct room at once get the one that won. */
    async insertRoom(room: NewRoom): Promise<ChatRoomEntity> {
        try {
            return await this.entityManager.transaction(async (manager) => {
                const id = this.ids.next()
                await manager.insert(ChatRoomEntity, {
                    id,
                    workspaceId: room.workspaceId,
                    kind: room.kind,
                    name: room.name,
                    directKey: room.directKey,
                    createdBy: room.createdBy,
                })
                const creator: ChatMemberRef = { memberKind: "user", memberId: room.createdBy }
                await manager.insert(ChatRoomMemberEntity, [
                    this.seatOf(room.workspaceId, id, creator, "owner"),
                    ...room.others.map((member) => this.seatOf(room.workspaceId, id, member, "member")),
                ])
                return manager.findOneOrFail(ChatRoomEntity, { where: { id } })
            })
        } catch (cause) {
            if (room.directKey !== null && isUniqueViolation(cause))
                return this.entityManager.findOneOrFail(ChatRoomEntity, {
                    where: { workspaceId: room.workspaceId, directKey: room.directKey },
                })
            throw cause
        }
    }

    /** Deletes a room; its members, messages and pins go with it. */
    async deleteRoom(roomId: string): Promise<void> {
        await this.entityManager.delete(ChatRoomEntity, { id: roomId })
    }

    /** The seat of one member in one room; null when the member does not sit in it. */
    memberOf(roomId: string, member: ChatMemberRef): Promise<OptionalRoomMember> {
        return this.entityManager.findOne(ChatRoomMemberEntity, {
            where: { roomId, memberKind: member.memberKind, memberId: member.memberId },
        })
    }

    /** Every seat of the given rooms, at most the member bound of each room. */
    membersOf(roomIds: ReadonlyArray<string>): Promise<Array<ChatRoomMemberEntity>> {
        return this.entityManager.find(ChatRoomMemberEntity, {
            where: { roomId: In([...roomIds]) },
            take: roomIds.length * MEMBERS_MAX,
        })
    }

    /** Seats a member in a group as an ordinary member, read up to the present moment. */
    async insertMember(workspaceId: string, roomId: string, member: ChatMemberRef): Promise<void> {
        await this.entityManager.insert(ChatRoomMemberEntity, this.seatOf(workspaceId, roomId, member, "member"))
    }

    /** Takes a member out of a room. */
    async deleteMember(roomId: string, member: ChatMemberRef): Promise<void> {
        await this.entityManager.delete(ChatRoomMemberEntity, {
            roomId,
            memberKind: member.memberKind,
            memberId: member.memberId,
        })
    }

    /** Sets the mute of a person's seat; false when the person has no seat in the room. */
    async setMuted(roomId: string, userId: string, muted: boolean): Promise<boolean> {
        const changed = await this.entityManager.update(
            ChatRoomMemberEntity,
            { roomId, memberKind: "user", memberId: userId },
            { muted },
        )
        return changed.affected !== 0
    }

    /** Moves a person's read position forward to one message, or to now; a position never moves back. */
    async moveReadPosition(workspaceId: string, roomId: string, userId: string, messageId: OptionalId): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ChatRoomMemberEntity, "member")
            .update(ChatRoomMemberEntity)
            .set({ lastReadAt: messageId === null ? READ_TO_NOW : READ_TO_MESSAGE })
            .where(
                "room_id = :roomId AND member_kind = 'user' AND member_id = :userId AND workspace_id = :workspaceId",
                {
                    roomId,
                    userId,
                    workspaceId,
                },
            )
            .setParameter("messageId", messageId)
            .execute()
    }

    /** One message of a room; null when the room has no such message. */
    messageIn(workspaceId: string, roomId: string, messageId: string): Promise<OptionalMessage> {
        return this.entityManager.findOne(ChatRoomMessageEntity, { where: { id: messageId, roomId, workspaceId } })
    }

    /** The message this author already sent under this client id, or null when there is none or no client id. */
    sentBefore(workspaceId: string, roomId: string, authorId: string, clientId: OptionalId): Promise<OptionalMessage> {
        return clientId === null
            ? Promise.resolve(null)
            : this.entityManager.findOne(ChatRoomMessageEntity, { where: { workspaceId, roomId, authorId, clientId } })
    }

    /** The messages of the workspace by id, in no order. */
    messagesByIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<ChatRoomMessageEntity>> {
        if (ids.length === 0) return Promise.resolve([])
        return this.entityManager.find(ChatRoomMessageEntity, {
            where: { id: In([...ids]), workspaceId },
            take: ids.length,
        })
    }

    /** Stores a person's text message; a retry that lost a race answers the message the first write stored. */
    async insertText(text: NewText): Promise<ChatRoomMessageEntity> {
        try {
            const id = this.ids.next()
            await this.entityManager.insert(ChatRoomMessageEntity, {
                id,
                roomId: text.roomId,
                workspaceId: text.workspaceId,
                authorKind: "user",
                authorId: text.authorId,
                body: text.body,
                kind: "text",
                ref: null,
                mentions: text.mentions,
                attachments: text.attachments,
                clientId: text.clientId,
            })
            return await this.entityManager.findOneOrFail(ChatRoomMessageEntity, { where: { id } })
        } catch (cause) {
            const again = isUniqueViolation(cause)
                ? await this.sentBefore(text.workspaceId, text.roomId, text.authorId, text.clientId)
                : null
            if (again === null) throw cause
            return again
        }
    }

    /** The keys of one page of a thread, newest first, one more than `size` so the caller sees whether another page follows. */
    threadKeys(
        workspaceId: string,
        roomId: string,
        after: OptionalPosition,
        size: number,
        pinnedOnly: boolean,
    ): Promise<Array<ThreadPosition>> {
        const query = this.entityManager
            .createQueryBuilder(ChatRoomMessageEntity, "msg")
            .select("msg.id", "id")
            .addSelect(CREATED_AT_MICROS, "at")
            .where("msg.room_id = :roomId AND msg.workspace_id = :workspaceId", { roomId, workspaceId })
        if (after !== null)
            query.andWhere("(msg.created_at, msg.id) < (CAST(:afterAt AS timestamptz), CAST(:afterId AS uuid))", {
                afterAt: after.at,
                afterId: after.id,
            })
        if (pinnedOnly) query.andWhere(IS_PINNED)
        return query
            .orderBy("msg.created_at", "DESC")
            .addOrderBy("msg.id", "DESC")
            .limit(size + 1)
            .getRawMany<ThreadPosition>()
    }

    /** The id of the newest message of each of the rooms. */
    async lastMessageIds(workspaceId: string, roomIds: ReadonlyArray<string>): Promise<Array<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(ChatRoomMessageEntity, "msg")
            .select("DISTINCT ON (msg.room_id) msg.id", "id")
            .where("msg.workspace_id = :workspaceId AND msg.room_id IN (:...roomIds)", {
                workspaceId,
                roomIds: [...roomIds],
            })
            .orderBy("msg.room_id")
            .addOrderBy("msg.created_at", "DESC")
            .addOrderBy("msg.id", "DESC")
            .limit(roomIds.length)
            .getRawMany<{ readonly id: string }>()
        return rows.map((row) => row.id)
    }

    /** What the viewer has unread in each of their rooms, or in one room; messages of their own never count. */
    async unreadRows(workspaceId: string, viewerId: string, roomId: OptionalId): Promise<Array<RoomUnread>> {
        const query = this.entityManager
            .createQueryBuilder(ChatRoomMemberEntity, "m")
            .leftJoin(
                ChatRoomMessageEntity,
                "msg",
                "msg.room_id = m.room_id AND msg.created_at > m.last_read_at AND (msg.author_kind <> 'user' OR msg.author_id <> m.member_id)",
            )
            .select("m.room_id", "room_id")
            .addSelect("count(msg.id)", "unread")
            .addSelect("count(msg.id) FILTER (WHERE msg.mentions @> CAST(:mention AS jsonb))", "mentions")
            .where("m.workspace_id = :workspaceId AND m.member_kind = 'user' AND m.member_id = :viewerId", {
                workspaceId,
                viewerId,
                mention: JSON.stringify([{ kind: "user", id: viewerId }]),
            })
        if (roomId !== null) query.andWhere("m.room_id = :roomId", { roomId })
        const rows = await query.groupBy("m.room_id").limit(ROOMS_MAX).getRawMany<UnreadRow>()
        return rows.map((row) => ({
            roomId: row.room_id,
            unreadCount: Number(row.unread),
            mentionCount: Number(row.mentions),
        }))
    }

    /** The ids of the given messages that are pinned in their rooms. */
    async pinnedAmong(messageIds: ReadonlyArray<string>): Promise<Set<string>> {
        const pins = await this.entityManager.find(ChatRoomPinEntity, {
            where: { messageId: In([...messageIds]) },
            take: messageIds.length,
        })
        return new Set(pins.map((pin) => pin.messageId))
    }

    /** Pins a message; pinning a pinned message changes nothing. */
    async insertPin(workspaceId: string, roomId: string, messageId: string, pinnedBy: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ChatRoomPinEntity, "pin")
            .insert()
            .into(ChatRoomPinEntity)
            .values({ roomId, messageId, workspaceId, pinnedBy })
            .orIgnore()
            .execute()
    }

    /** Takes a pin off; unpinning a message that is not pinned changes nothing. */
    async deletePin(roomId: string, messageId: string): Promise<void> {
        await this.entityManager.delete(ChatRoomPinEntity, { roomId, messageId })
    }

    /** Stores one card of an engine object; the unique index makes a repeat the same card. Null when neither this write nor an earlier one holds it. */
    async insertCard(card: NewCard): Promise<OptionalCard> {
        const { key, ref } = cardRefOf(card.kind, card.refId)
        const inserted = await this.entityManager
            .createQueryBuilder(ChatRoomMessageEntity, "msg")
            .insert()
            .into(ChatRoomMessageEntity)
            .values({
                roomId: card.roomId,
                workspaceId: card.workspaceId,
                authorKind: card.authorId === null ? "system" : "agent",
                authorId: card.authorId,
                body: card.body,
                kind: card.kind,
                ref,
            })
            .orIgnore()
            .returning("id")
            .execute()
        const [created] = returnedIdRows(inserted.raw)
        if (created !== undefined) return { messageId: created.id, created: true }
        const [kept] = await this.entityManager
            .createQueryBuilder(ChatRoomMessageEntity, "msg")
            .where("msg.room_id = :roomId AND msg.kind = :kind AND (msg.ref ->> CAST(:key AS text)) = :refId", {
                roomId: card.roomId,
                kind: card.kind,
                key,
                refId: card.refId,
            })
            .limit(1)
            .getMany()
        return kept === undefined ? null : { messageId: kept.id, created: false }
    }

    /** Stores one line of an agent or of the system; the id of the new message, or null when the same key already wrote it. */
    async insertLine(line: NewLine): Promise<OptionalId> {
        const inserted = await this.entityManager
            .createQueryBuilder(ChatRoomMessageEntity, "msg")
            .insert()
            .into(ChatRoomMessageEntity)
            .values({
                roomId: line.roomId,
                workspaceId: line.workspaceId,
                authorKind: line.authorAgentId === null ? "system" : "agent",
                authorId: line.authorAgentId,
                body: line.body,
                kind: line.authorAgentId === null ? "system" : "text",
                clientId: line.key,
            })
            .orIgnore()
            .returning("id")
            .execute()
        return returnedIdRows(inserted.raw)[0]?.id ?? null
    }

    /** The message an agent already wrote under a key in a room; null when there is none. */
    async lineKept(roomId: string, authorId: string, clientId: string): Promise<OptionalId> {
        const kept = await this.entityManager.findOne(ChatRoomMessageEntity, { where: { roomId, authorId, clientId } })
        return kept?.id ?? null
    }

    private seatOf(
        workspaceId: string,
        roomId: string,
        member: ChatMemberRef,
        role: RoomRole,
    ): QueryDeepPartialEntity<ChatRoomMemberEntity> {
        return {
            roomId,
            workspaceId,
            memberKind: member.memberKind,
            memberId: member.memberId,
            role,
            lastReadAt: DATABASE_NOW,
        }
    }
}
