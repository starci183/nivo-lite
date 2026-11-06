import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity } from "./persistence/entities"
import {
    cursorOf,
    directKeyOf,
    groupNameOf,
    pageSizeOf,
    positionOf,
    sendProblem,
    uniqueMembers,
} from "./team-chat.policy"
import { MEMBERS_MAX, ROOMS_MAX } from "./team-chat.contracts"
import type {
    MemberRef,
    MessagePage,
    ApprovalState,
    MessageView,
    RoomMemberView,
    RoomUnread,
    RoomView,
    SendInput,
    TeamChatResult,
    UnreadView,
} from "./team-chat.contracts"

/** The postgres error code of a unique violation: a retry or a race reached a row that already exists. */
const UNIQUE_VIOLATION = "23505"

/** The database clock as an insert value: every instant of the chat is the database's, so read positions and messages compare on one clock. */
const DATABASE_NOW = (): string => "now()"

/** The longest body a card keeps. */
const CARD_BODY_MAX = 20000

/** The microsecond text of a column, so a cursor is exact. */
const AT = (column: string): string => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

const refused = (refusal: TeamChatErrorCode): { readonly ok: false; readonly refusal: TeamChatErrorCode } => ({
    ok: false,
    refusal,
})
const done = <V>(value: V): { readonly ok: true; readonly value: V } => ({ ok: true, value })

const isUnique = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && Reflect.get(cause, "code") === UNIQUE_VIOLATION

/** The most active seats one workspace holds that a membership check reads. */
const SEATS_MAX = 5000

/** One raw row of the thread query. */
interface ThreadRow {
    readonly id: string
    readonly at: string
}

@Injectable()
/**
 * The internal team chat of a workspace: rooms (direct of two, or groups), their members (people and agents), the messages, the pins
 * and what each member has read. A person sees the rooms they sit in; an owner of the workspace sees them all. Every read and write
 * checks that here, and every refusal is returned as data. The chat does no business: reports and approval cards are written by the
 * engine's jobs through the engine-side methods, a person can only ever write text.
 */
export class TeamChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly people: WorkspaceMembersReadService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The rooms the viewer sits in (all of them for an owner), newest message first. */
    async rooms(
        workspaceId: string,
        viewerId: string,
        kind: "direct" | "group" | null,
        member: string | null = null,
    ): Promise<Array<RoomView>> {
        const owner = await this.isOwner(workspaceId, viewerId)
        const rows = await this.entityManager
            .createQueryBuilder(ChatRoomEntity, "room")
            .where("room.workspace_id = :workspaceId", { workspaceId })
            .andWhere(kind === null ? "TRUE" : "room.kind = :kind", { kind })
            .andWhere(
                member === null
                    ? "TRUE"
                    : "EXISTS (SELECT 1 FROM public.chat_room_members w WHERE w.room_id = room.id AND w.member_id = :member AND w.member_id <> :viewerId)",
                { member, viewerId },
            )
            .andWhere(
                owner
                    ? "TRUE"
                    : "EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id = room.id AND m.member_kind = 'user' AND m.member_id = :viewerId)",
                { viewerId },
            )
            .orderBy("room.position", "ASC")
            .addOrderBy("room.id", "ASC")
            .take(ROOMS_MAX)
            .getMany()
        const views = await this.roomViews(workspaceId, viewerId, rows)
        return views.toSorted(
            (left, right) =>
                (right.lastMessage?.createdAt.getTime() ?? 0) - (left.lastMessage?.createdAt.getTime() ?? 0) ||
                left.position - right.position,
        )
    }

    /** One room for the viewer; null when it is absent or the viewer may not see it. */
    async room(workspaceId: string, viewerId: string, roomId: string): Promise<RoomView | null> {
        const found = await this.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return null
        const [view] = await this.roomViews(workspaceId, viewerId, [found])
        return view ?? null
    }

    /** One page of a room's thread, newest first; an empty page for a room the viewer may not see. */
    async messages(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        first: number | null,
        after: string | null,
        pinnedOnly: boolean,
    ): Promise<MessagePage> {
        const empty: MessagePage = { nodes: [], hasNextPage: false, endCursor: null }
        if ((await this.visibleRoom(workspaceId, viewerId, roomId)) === null) return empty
        const position = after === null ? null : positionOf(after)
        if (after !== null && position === null) return empty
        const size = pageSizeOf(first)
        const rows: Array<ThreadRow> = await this.entityManager.query(
            `SELECT msg.id, ${AT("msg.created_at")} AS at
               FROM public.chat_room_messages msg
              WHERE msg.room_id = $1 AND msg.workspace_id = $2
                AND ($3::text IS NULL OR (msg.created_at, msg.id) < ($3::timestamptz, $4::uuid))
                AND (NOT $5 OR EXISTS (SELECT 1 FROM public.chat_room_pins p WHERE p.message_id = msg.id))
              ORDER BY msg.created_at DESC, msg.id DESC
              LIMIT $6`,
            [roomId, workspaceId, position?.at ?? null, position?.id ?? null, pinnedOnly, size + 1],
        )
        const shown = rows.slice(0, size)
        const entities = await this.entityManager.find(ChatRoomMessageEntity, {
            where: { id: In(shown.map((row) => row.id)), workspaceId },
        })
        const order = new Map(shown.map((row, index) => [row.id, index]))
        const sorted = entities.toSorted((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
        const last = shown.at(-1)
        return {
            nodes: await this.messageViews(workspaceId, roomId, sorted, viewerId),
            hasNextPage: rows.length > size,
            endCursor: rows.length > size && last !== undefined ? cursorOf(last) : null,
        }
    }

    /** What every room the viewer sits in has unread; only the rooms with something unread. */
    async unread(workspaceId: string, viewerId: string): Promise<UnreadView> {
        const rooms = await this.unreadRows(workspaceId, viewerId, null)
        return {
            total: rooms.reduce((sum, room) => sum + room.unreadCount, 0),
            mentionTotal: rooms.reduce((sum, room) => sum + room.mentionCount, 0),
            rooms: rooms.filter((room) => room.unreadCount > 0),
        }
    }

    /** Opens a room; a direct room of a pair that already has one answers that one. */
    async createRoom(
        workspaceId: string,
        viewerId: string,
        input: { readonly kind: "direct" | "group"; readonly name: string | null; readonly members: ReadonlyArray<MemberRef> },
    ): Promise<TeamChatResult<RoomView>> {
        const creator: MemberRef = { memberKind: "user", memberId: viewerId }
        const others = uniqueMembers(input.members, creator)
        const name = groupNameOf(input.name)
        if (input.kind === "direct" && (others.length !== 1 || input.name !== null))
            return refused(TeamChatErrorCode.DirectNeedsTwo)
        if (input.kind === "group" && name === null) return refused(TeamChatErrorCode.GroupNeedsName)
        if (!(await this.allKnown(workspaceId, others))) return refused(TeamChatErrorCode.MemberUnknown)
        const [other] = others
        const directKey = input.kind === "direct" && other !== undefined ? directKeyOf(creator, other) : null
        const existing =
            directKey === null
                ? null
                : await this.entityManager.findOne(ChatRoomEntity, { where: { workspaceId, directKey } })
        const room = existing ?? (await this.insertRoom(workspaceId, viewerId, input.kind, name, directKey, others))
        return done((await this.room(workspaceId, viewerId, room.id)) ?? (await this.roomOrThrow(workspaceId, room.id)))
    }

    /** Adds a person or an agent to a group. */
    async addMember(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        member: MemberRef,
    ): Promise<TeamChatResult<RoomView>> {
        const found = await this.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return refused(TeamChatErrorCode.NotFound)
        if (found.kind === "direct" || !(await this.mayManage(workspaceId, viewerId, found)))
            return refused(TeamChatErrorCode.Forbidden)
        if (!(await this.allKnown(workspaceId, [member]))) return refused(TeamChatErrorCode.MemberUnknown)
        const held = await this.entityManager.findOne(ChatRoomMemberEntity, {
            where: { roomId, memberKind: member.memberKind, memberId: member.memberId },
        })
        if (held !== null) return refused(TeamChatErrorCode.AlreadyMember)
        await this.entityManager.insert(ChatRoomMemberEntity, {
            roomId,
            workspaceId,
            memberKind: member.memberKind,
            memberId: member.memberId,
            role: "member",
            lastReadAt: DATABASE_NOW,
        })
        return done(await this.roomOrThrow(workspaceId, roomId, viewerId))
    }

    /** Removes a member from a group; a member may remove themselves. Answers null when the room went with its last member. */
    async removeMember(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        member: MemberRef,
    ): Promise<TeamChatResult<RoomView | null>> {
        const found = await this.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return refused(TeamChatErrorCode.NotFound)
        const itself = member.memberKind === "user" && member.memberId === viewerId
        if (found.kind === "direct" || !(itself || (await this.mayManage(workspaceId, viewerId, found))))
            return refused(TeamChatErrorCode.Forbidden)
        const held = await this.entityManager.find(ChatRoomMemberEntity, { where: { roomId }, take: MEMBERS_MAX })
        const target = held.find((row) => row.memberKind === member.memberKind && row.memberId === member.memberId)
        if (target === undefined) return refused(TeamChatErrorCode.NotAMemberToRemove)
        const rest = held.filter((row) => row !== target)
        if (rest.length === 0) {
            await this.entityManager.delete(ChatRoomEntity, { id: roomId })
            return done(null)
        }
        if (target.role === "owner" && !rest.some((row) => row.role === "owner"))
            return refused(TeamChatErrorCode.LastOwner)
        await this.entityManager.delete(ChatRoomMemberEntity, {
            roomId,
            memberKind: member.memberKind,
            memberId: member.memberId,
        })
        return done(await this.room(workspaceId, viewerId, roomId))
    }

    /** Writes a text message; the same client id from the same author in the same room is the same message. */
    async send(workspaceId: string, viewerId: string, input: SendInput): Promise<TeamChatResult<MessageView>> {
        const roomId = input.roomId ?? (await this.directRoomTo(workspaceId, viewerId, input.to))
        const found = roomId === null ? null : await this.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return refused(TeamChatErrorCode.NotFound)
        const mentions = uniqueMembers(input.mentions, null)
        const problem = sendProblem(input.body, mentions.length, input.fileKeys.length)
        if (problem !== null) return refused(problem)
        if (!(await this.allKnown(workspaceId, mentions))) return refused(TeamChatErrorCode.MemberUnknown)
        const retried = await this.sent(workspaceId, found.id, viewerId, input.clientId)
        const message = retried ?? (await this.insertMessage(workspaceId, found.id, viewerId, input, mentions))
        const [view] = await this.messageViews(workspaceId, found.id, [message], viewerId)
        await this.entityManager.query(
            `UPDATE public.chat_room_members SET last_read_at = GREATEST(last_read_at, (SELECT created_at FROM public.chat_room_messages WHERE id = $4))
              WHERE room_id = $1 AND member_kind = 'user' AND member_id = $2 AND workspace_id = $3`,
            [found.id, viewerId, workspaceId, message.id],
        )
        return done(view as MessageView)
    }

    /** Moves the viewer's read position to a message (the newest when none is named). */
    async markRead(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        messageId: string | null,
    ): Promise<TeamChatResult<RoomUnread>> {
        const found = await this.visibleRoom(workspaceId, viewerId, roomId)
        if (found === null) return refused(TeamChatErrorCode.NotFound)
        const seat = await this.entityManager.findOne(ChatRoomMemberEntity, {
            where: { roomId, memberKind: "user", memberId: viewerId },
        })
        if (seat === null) return refused(TeamChatErrorCode.NotMember)
        const target =
            messageId === null
                ? null
                : await this.entityManager.findOne(ChatRoomMessageEntity, { where: { id: messageId, roomId } })
        if (messageId !== null && target === null) return refused(TeamChatErrorCode.NotFound)
        await this.entityManager.query(
            `UPDATE public.chat_room_members
                SET last_read_at = GREATEST(last_read_at, COALESCE((SELECT created_at FROM public.chat_room_messages WHERE id = $4), now()))
              WHERE room_id = $1 AND member_kind = 'user' AND member_id = $2 AND workspace_id = $3`,
            [roomId, viewerId, workspaceId, target?.id ?? null],
        )
        const [row] = await this.unreadRows(workspaceId, viewerId, roomId)
        return done(row ?? { roomId, unreadCount: 0, mentionCount: 0 })
    }

    /** Pins a message of a room; pinning a pinned message changes nothing. */
    async pin(workspaceId: string, viewerId: string, roomId: string, messageId: string): Promise<TeamChatResult<MessageView>> {
        const message = await this.pinnable(workspaceId, viewerId, roomId, messageId)
        if (message === null) return refused(TeamChatErrorCode.NotFound)
        await this.entityManager
            .createQueryBuilder()
            .insert()
            .into(ChatRoomPinEntity)
            .values({ roomId, messageId, workspaceId, pinnedBy: viewerId })
            .orIgnore()
            .execute()
        return done(await this.viewOf(workspaceId, message, viewerId))
    }

    /** Takes a pin off; unpinning a message that is not pinned changes nothing. */
    async unpin(workspaceId: string, viewerId: string, roomId: string, messageId: string): Promise<TeamChatResult<MessageView>> {
        const message = await this.pinnable(workspaceId, viewerId, roomId, messageId)
        if (message === null) return refused(TeamChatErrorCode.NotFound)
        await this.entityManager.delete(ChatRoomPinEntity, { roomId, messageId })
        return done(await this.viewOf(workspaceId, message, viewerId))
    }

    /** The direct room with the member, opened when the pair has none yet (the first message to someone opens it). */
    private async directRoomTo(workspaceId: string, viewerId: string, to: MemberRef | null): Promise<string | null> {
        if (to === null) return null
        const opened = await this.createRoom(workspaceId, viewerId, { kind: "direct", name: null, members: [to] })
        return opened.ok ? opened.value.id : null
    }

    private async isOwner(workspaceId: string, userId: string): Promise<boolean> {
        return (await this.seats.activeSeatOfUser(workspaceId, userId))?.role === "owner"
    }

    /** The room when the viewer sits in it or owns the workspace; null otherwise. */
    private async visibleRoom(workspaceId: string, viewerId: string, roomId: string): Promise<ChatRoomEntity | null> {
        const found = await this.entityManager.findOne(ChatRoomEntity, { where: { id: roomId, workspaceId } })
        if (found === null) return null
        const seat = await this.entityManager.findOne(ChatRoomMemberEntity, {
            where: { roomId, memberKind: "user", memberId: viewerId },
        })
        return seat !== null || (await this.isOwner(workspaceId, viewerId)) ? found : null
    }

    /** Whether the viewer may change the members of a group: an owner of the workspace or of the room. */
    private async mayManage(workspaceId: string, viewerId: string, room: ChatRoomEntity): Promise<boolean> {
        if (await this.isOwner(workspaceId, viewerId)) return true
        const seat = await this.entityManager.findOne(ChatRoomMemberEntity, {
            where: { roomId: room.id, memberKind: "user", memberId: viewerId },
        })
        return seat?.role === "owner"
    }

    private async pinnable(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        messageId: string,
    ): Promise<ChatRoomMessageEntity | null> {
        if ((await this.visibleRoom(workspaceId, viewerId, roomId)) === null) return null
        return this.entityManager.findOne(ChatRoomMessageEntity, { where: { id: messageId, roomId, workspaceId } })
    }

    /** Whether every named member is an active person or an active agent of the workspace. */
    private async allKnown(workspaceId: string, members: ReadonlyArray<MemberRef>): Promise<boolean> {
        const users = members.filter((member) => member.memberKind === "user").map((member) => member.memberId)
        const agentIds = members.filter((member) => member.memberKind === "agent").map((member) => member.memberId)
        const [seated, agents] = await Promise.all([
            users.length === 0 ? [] : this.seats.activeUsers(workspaceId, SEATS_MAX),
            this.agents.activeInOrder(workspaceId, agentIds, agentIds.length),
        ])
        const active = new Set(seated.map((seat) => seat.userId))
        return users.every((user) => active.has(user)) && agents.length === new Set(agentIds).size
    }

    private async insertRoom(
        workspaceId: string,
        viewerId: string,
        kind: "direct" | "group",
        name: string | null,
        directKey: string | null,
        others: ReadonlyArray<MemberRef>,
    ): Promise<ChatRoomEntity> {
        try {
            return await this.entityManager.transaction(async (manager) => {
                const inserted = await manager.insert(ChatRoomEntity, {
                    workspaceId,
                    kind,
                    name: kind === "group" ? name : null,
                    directKey,
                    createdBy: viewerId,
                })
                const id = (inserted.identifiers[0] as { id: string }).id
                await manager.insert(ChatRoomMemberEntity, [
                    { roomId: id, workspaceId, memberKind: "user", memberId: viewerId, role: "owner", lastReadAt: DATABASE_NOW },
                    ...others.map((member) => ({
                        roomId: id,
                        workspaceId,
                        memberKind: member.memberKind,
                        memberId: member.memberId,
                        role: "member",
                        lastReadAt: DATABASE_NOW,
                    })),
                ])
                return manager.findOneOrFail(ChatRoomEntity, { where: { id } })
            })
        } catch (cause) {
            // two people opening the same direct room at once: the second finds the first
            if (directKey !== null && isUnique(cause))
                return this.entityManager.findOneOrFail(ChatRoomEntity, { where: { workspaceId, directKey } })
            throw cause
        }
    }

    private async insertMessage(
        workspaceId: string,
        roomId: string,
        viewerId: string,
        input: SendInput,
        mentions: ReadonlyArray<MemberRef>,
    ): Promise<ChatRoomMessageEntity> {
        try {
            const inserted = await this.entityManager.insert(ChatRoomMessageEntity, {
                roomId,
                workspaceId,
                authorKind: "user",
                authorId: viewerId,
                body: input.body,
                kind: "text",
                ref: null,
                mentions: mentions.map((member) => ({ kind: member.memberKind, id: member.memberId })),
                attachments: [],
                clientId: input.clientId,
            })
            const id = (inserted.identifiers[0] as { id: string }).id
            return await this.entityManager.findOneOrFail(ChatRoomMessageEntity, { where: { id } })
        } catch (cause) {
            const again = isUnique(cause) ? await this.sent(workspaceId, roomId, viewerId, input.clientId) : null
            if (again === null) throw cause
            return again
        }
    }

    /** The message this author already sent under this client id, or null. */
    private sent(
        workspaceId: string,
        roomId: string,
        authorId: string,
        clientId: string | null,
    ): Promise<ChatRoomMessageEntity | null> {
        return clientId === null
            ? Promise.resolve(null)
            : this.entityManager.findOne(ChatRoomMessageEntity, { where: { workspaceId, roomId, authorId, clientId } })
    }

    private async roomOrThrow(workspaceId: string, roomId: string, viewerId?: string): Promise<RoomView> {
        const found = await this.entityManager.findOneOrFail(ChatRoomEntity, { where: { id: roomId, workspaceId } })
        const [view] = await this.roomViews(workspaceId, viewerId ?? found.createdBy, [found])
        return view as RoomView
    }

    /** The unread counts of the viewer's rooms (or of one room). */
    private async unreadRows(workspaceId: string, viewerId: string, roomId: string | null): Promise<Array<RoomUnread>> {
        const rows: Array<{ room_id: string; unread: string; mentions: string }> = await this.entityManager.query(
            `SELECT m.room_id,
                    count(msg.id) FILTER (WHERE msg.id IS NOT NULL) AS unread,
                    count(msg.id) FILTER (WHERE msg.mentions @> jsonb_build_array(jsonb_build_object('kind', 'user', 'id', $2::text))) AS mentions
               FROM public.chat_room_members m
               LEFT JOIN public.chat_room_messages msg
                      ON msg.room_id = m.room_id AND msg.created_at > m.last_read_at
                     AND (msg.author_kind <> 'user' OR msg.author_id <> m.member_id)
              WHERE m.workspace_id = $1 AND m.member_kind = 'user' AND m.member_id = $2::uuid
                AND ($3::uuid IS NULL OR m.room_id = $3::uuid)
              GROUP BY m.room_id`,
            [workspaceId, viewerId, roomId],
        )
        return rows.map((row) => ({ roomId: row.room_id, unreadCount: Number(row.unread), mentionCount: Number(row.mentions) }))
    }

    private async roomViews(
        workspaceId: string,
        viewerId: string,
        rooms: ReadonlyArray<ChatRoomEntity>,
    ): Promise<Array<RoomView>> {
        if (rooms.length === 0) return []
        const ids = rooms.map((room) => room.id)
        const members = await this.entityManager.find(ChatRoomMemberEntity, {
            where: { roomId: In(ids) },
            take: ids.length * MEMBERS_MAX,
        })
        const names = await this.namesOf(
            workspaceId,
            members.map((member) => ({ memberKind: member.memberKind as MemberRef["memberKind"], memberId: member.memberId })),
        )
        const unread = new Map((await this.unreadRows(workspaceId, viewerId, null)).map((row) => [row.roomId, row]))
        const lasts = await this.lastMessages(workspaceId, viewerId, ids)
        return rooms.map((room) => {
            const seated = members.filter((member) => member.roomId === room.id)
            const views = seated
                .map<RoomMemberView>((member) => ({
                    memberKind: member.memberKind as MemberRef["memberKind"],
                    memberId: member.memberId,
                    name: names.get(`${member.memberKind}:${member.memberId}`) ?? "",
                    role: member.role as "owner" | "member",
                    lastReadAt: member.lastReadAt,
                    muted: member.muted,
                }))
                .toSorted((left, right) => Number(right.role === "owner") - Number(left.role === "owner") || left.name.localeCompare(right.name))
                .slice(0, MEMBERS_MAX)
            const mine = seated.find((member) => member.memberKind === "user" && member.memberId === viewerId)
            const other = views.find((member) => !(member.memberKind === "user" && member.memberId === viewerId))
            return {
                id: room.id,
                kind: room.kind as "direct" | "group",
                name: room.kind === "group" ? (room.name ?? "") : (other?.name ?? ""),
                position: room.position,
                createdBy: room.createdBy,
                createdAt: room.createdAt,
                members: views,
                unreadCount: unread.get(room.id)?.unreadCount ?? 0,
                mentionCount: unread.get(room.id)?.mentionCount ?? 0,
                muted: mine?.muted ?? false,
                lastMessage: lasts.get(room.id) ?? null,
            }
        })
    }

    /** The newest message of each room. */
    private async lastMessages(
        workspaceId: string,
        viewerId: string,
        roomIds: ReadonlyArray<string>,
    ): Promise<Map<string, MessageView>> {
        const rows: Array<{ id: string }> = await this.entityManager.query(
            `SELECT DISTINCT ON (room_id) id FROM public.chat_room_messages
              WHERE workspace_id = $1 AND room_id = ANY($2::uuid[])
              ORDER BY room_id, created_at DESC, id DESC`,
            [workspaceId, [...roomIds]],
        )
        const entities = await this.entityManager.find(ChatRoomMessageEntity, {
            where: { id: In(rows.map((row) => row.id)), workspaceId },
        })
        const views = await Promise.all(entities.map((entity) => this.viewOf(workspaceId, entity, viewerId)))
        return new Map(views.map((view) => [view.roomId, view]))
    }

    private async viewOf(workspaceId: string, message: ChatRoomMessageEntity, viewerId: string): Promise<MessageView> {
        const [view] = await this.messageViews(workspaceId, message.roomId, [message], viewerId)
        return view as MessageView
    }

    private async messageViews(
        workspaceId: string,
        roomId: string,
        messages: ReadonlyArray<ChatRoomMessageEntity>,
        viewerId: string,
    ): Promise<Array<MessageView>> {
        if (messages.length === 0) return []
        const refs = messages.flatMap<MemberRef>((message) => [
            ...(message.authorId === null
                ? []
                : [{ memberKind: message.authorKind as MemberRef["memberKind"], memberId: message.authorId }]),
            ...message.mentions.map((mention) => ({
                memberKind: mention["kind"] as MemberRef["memberKind"],
                memberId: mention["id"] as string,
            })),
        ])
        const names = await this.namesOf(workspaceId, refs)
        const pins = await this.entityManager.find(ChatRoomPinEntity, {
            where: { roomId, messageId: In(messages.map((message) => message.id)) },
        })
        const pinned = new Set(pins.map((pin) => pin.messageId))
        const approvals = await this.approvalStates(
            workspaceId,
            viewerId,
            messages.flatMap((message) => (message.kind === "approval" && message.ref !== null ? [message.ref["decision_id"] ?? ""] : [])),
        )
        return messages.map((message) => ({
            id: message.id,
            roomId: message.roomId,
            kind: message.kind as MessageView["kind"],
            authorKind: message.authorKind as MessageView["authorKind"],
            authorId: message.authorId,
            authorName:
                message.authorId === null ? "" : (names.get(`${message.authorKind}:${message.authorId}`) ?? ""),
            body: message.body,
            createdAt: message.createdAt,
            editedAt: message.editedAt,
            pinned: pinned.has(message.id),
            mentions: message.mentions.map((mention) => ({
                memberKind: mention["kind"] as MemberRef["memberKind"],
                memberId: mention["id"] as string,
                name: names.get(`${mention["kind"]}:${mention["id"]}`) ?? "",
            })),
            attachments: [],
            runId: message.kind === "report" ? (message.ref?.["run_id"] ?? null) : null,
            decisionId: message.kind === "approval" ? (message.ref?.["decision_id"] ?? null) : null,
            approval: approvals.get(message.ref?.["decision_id"] ?? "") ?? null,
        }))
    }


    /**
     * Writes the report of a finished run: ONE `report` message with the run as its ref, in the room the agent is configured to report
     * to, else in the direct room between the agent and the owner of the workspace, opened here when it does not exist (never on a read).
     * A retry of the job finds the card it wrote. Null when the workspace, the agent or the room is gone.
     */
    async postReport(
        workspaceId: string,
        report: { readonly runId: string; readonly agentId: string; readonly body: string; readonly roomId: string | null },
    ): Promise<{ readonly roomId: string; readonly messageId: string; readonly created: boolean } | null> {
        const roomId = await this.reportRoom(workspaceId, report.agentId, report.roomId)
        if (roomId === null) return null
        const written = await this.insertCard(workspaceId, roomId, "report", "run_id", report.runId, report.agentId, report.body)
        return { roomId, ...written }
    }

    /**
     * Posts the approval card of one decision to every room the rule names and to the direct room of every named approver (opened here
     * between the asking agent and that person). One card per decision per room: a repeat posts nothing new. Answers how many cards exist.
     */
    async postApproval(
        workspaceId: string,
        approval: {
            readonly decisionId: string
            readonly body: string
            readonly agentId: string | null
            readonly roomIds: ReadonlyArray<string>
            readonly approverSeatIds: ReadonlyArray<string>
        },
    ): Promise<number> {
        const named = approval.roomIds.length === 0
            ? []
            : await this.entityManager.find(ChatRoomEntity, { where: { id: In([...approval.roomIds]), workspaceId } })
        const seats = approval.approverSeatIds.length === 0 || approval.agentId === null
            ? []
            : await this.seats.seatsByIds(workspaceId, approval.approverSeatIds, approval.approverSeatIds.length)
        const direct = await Promise.all(
            seats.map((seat) => this.directRoomOf(workspaceId, seat.userId, { memberKind: "agent", memberId: approval.agentId ?? "" })),
        )
        const rooms = [...new Set([...named.map((room) => room.id), ...direct.flatMap((id) => (id === null ? [] : [id]))])]
        await Promise.all(
            rooms.map((roomId) =>
                this.insertCard(workspaceId, roomId, "approval", "decision_id", approval.decisionId, approval.agentId, approval.body),
            ),
        )
        return rooms.length
    }

    /** Where each decision stands, for the viewer: pending, approved, refused or expired, who settled it, and whether the viewer may. */
    private async approvalStates(
        workspaceId: string,
        viewerId: string,
        decisionIds: ReadonlyArray<string>,
    ): Promise<Map<string, ApprovalState>> {
        if (decisionIds.length === 0) return new Map()
        const seat = await this.seats.activeSeatOfUser(workspaceId, viewerId)
        const rows: Array<{
            id: string
            status: string
            resolved_at: Date | null
            by_name: string | null
            approvers: ReadonlyArray<{ readonly memberId?: string }>
        }> = await this.entityManager.query(
            `SELECT r.id, r.status, r.resolved_at, r.approvers, m.display_name AS by_name
               FROM public.approval_requests r LEFT JOIN public.workspace_members m ON m.id = r.resolved_by
              WHERE r.workspace_id = $1 AND r.id = ANY($2::uuid[])`,
            [workspaceId, [...new Set(decisionIds)]],
        )
        return new Map(
            rows.map((row) => [
                row.id,
                {
                    decisionId: row.id,
                    status: row.status === "rejected" ? "refused" : (row.status as ApprovalState["status"]),
                    decidedByName: row.by_name,
                    decidedAt: row.resolved_at,
                    canDecide:
                        row.status === "pending" &&
                        seat !== null &&
                        row.approvers.some((approver) => approver.memberId === seat.memberId),
                },
            ]),
        )
    }

    /** The room a run reports to: the configured one when it is of the workspace, else the agent's direct room with the owner. */
    private async reportRoom(workspaceId: string, agentId: string, preferred: string | null): Promise<string | null> {
        if (preferred !== null) {
            const configured = await this.entityManager.findOne(ChatRoomEntity, { where: { id: preferred, workspaceId } })
            if (configured !== null) return configured.id
        }
        const owner: Array<{ owner_id: string }> = await this.entityManager.query(
            "SELECT owner_id FROM public.workspaces WHERE id = $1",
            [workspaceId],
        )
        const ownerId = owner[0]?.owner_id
        return ownerId === undefined ? null : this.directRoomOf(workspaceId, ownerId, { memberKind: "agent", memberId: agentId })
    }

    /** The direct room of a person and a member, opened when the pair has none; null when the member is not of the workspace. */
    private async directRoomOf(workspaceId: string, userId: string, other: MemberRef): Promise<string | null> {
        const me: MemberRef = { memberKind: "user", memberId: userId }
        if (!(await this.allKnown(workspaceId, [other]))) return null
        const directKey = directKeyOf(me, other)
        const existing = await this.entityManager.findOne(ChatRoomEntity, { where: { workspaceId, directKey } })
        if (existing !== null) return existing.id
        return (await this.insertRoom(workspaceId, userId, "direct", null, directKey, [other])).id
    }

    /** Writes one card of a kind for one engine object in one room; the unique index makes a repeat the same card. */
    private async insertCard(
        workspaceId: string,
        roomId: string,
        kind: "report" | "approval",
        refKey: "run_id" | "decision_id",
        refId: string,
        authorId: string | null,
        body: string,
    ): Promise<{ readonly messageId: string; readonly created: boolean }> {
        const inserted: Array<{ id: string }> = await this.entityManager.query(
            `INSERT INTO public.chat_room_messages (room_id, workspace_id, author_kind, author_id, body, kind, ref)
                  VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object($7::text, $8::text))
             ON CONFLICT DO NOTHING RETURNING id`,
            [roomId, workspaceId, authorId === null ? "system" : "agent", authorId, body.slice(0, CARD_BODY_MAX), kind, refKey, refId],
        )
        const created = inserted[0]
        if (created !== undefined) return { messageId: created.id, created: true }
        const found = await this.entityManager.findOneOrFail(ChatRoomMessageEntity, { where: { roomId, kind } })
        return { messageId: found.id, created: false }
    }

    /** The names of people and agents of the workspace by `kind:id`. */
    private async namesOf(workspaceId: string, refs: ReadonlyArray<MemberRef>): Promise<Map<string, string>> {
        const users = [...new Set(refs.filter((ref) => ref.memberKind === "user").map((ref) => ref.memberId))]
        const agentIds = [...new Set(refs.filter((ref) => ref.memberKind === "agent").map((ref) => ref.memberId))]
        const [people, agents] = await Promise.all([
            this.people.namesOf(workspaceId, users),
            this.agents.activeInOrder(workspaceId, agentIds, agentIds.length),
        ])
        return new Map([
            ...people.map((person) => [`user:${person.userId}`, person.displayName] as const),
            ...agents.map((agent) => [`agent:${agent.id}`, agent.name] as const),
        ])
    }
}
