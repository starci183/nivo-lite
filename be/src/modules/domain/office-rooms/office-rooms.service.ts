import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isOfficeRoomKey, OfficeCardsService } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { OfficeRoomsError, OfficeRoomsErrorCode } from "./errors/office-rooms.error"
import type { AgentConversationView, ConversationUnreadListView, RoomChoice, RoomView } from "./office-rooms.contracts"
import type {
    AgentConversationRow,
    ConversationUnreadRow,
    OpenedRow,
    RoomMembersRow,
    RoomRow,
    RoomSummaryRow,
} from "./persistence/office-rooms.rows"
import { LIST_ROOM_MEMBERS } from "./persistence/office-room-members.sql"
import {
    ENSURE_ROOMS,
    LIST_AGENT_UNREAD,
    LIST_LEAD_UNREAD,
    LIST_ROOMS,
    MARK_AGENT_READ,
    MARK_LEAD_READ,
    MARK_ROOM_READ,
    OFFICE_ROOM_SUMMARY,
} from "./persistence/office-rooms.sql"

/** Only owners and managers open the department rooms of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
/** The read marker key of the general Office room. */
const OFFICE_READ_KEY = ""

/** The marker-write of each direct conversation kind; undefined names a kind that is not one. */
const markOf = (kind: string) => {
    if (kind === "agent") return MARK_AGENT_READ
    if (kind === "lead") return MARK_LEAD_READ
    return undefined
}

/** Only the conversations with unseen lines, as the badge contract reads them. */
const withUnread = (rows: ReadonlyArray<ConversationUnreadRow>) => rows.filter((row) => row.unread > 0)

/** One agent's direct conversation as the row draws it: the unread count and the newest line, even fully read. */
const agentConversationOf = (row: AgentConversationRow): AgentConversationView => ({
    id: row.id,
    unread: row.unread,
    last:
        row.last_at === null
            ? null
            : { body: row.last_body ?? "", at: row.last_at, authorId: row.last_author_id, author: row.last_author },
})

const EMPTY_SUMMARY: RoomSummaryRow = { unread: 0, last_body: null, last_author: null, last_at: null }

@Injectable()
/** The Hub rooms: the general Office room first, then the department rooms, each with the caller's unread count. */
export class OfficeRoomsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly cards: OfficeCardsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** The rooms the caller sees; a workspace without department rooms answers the Office room alone. */
    async rooms(principalId: string, workspaceId: string): Promise<ReadonlyArray<RoomView>> {
        const member = await this.members.require(principalId, workspaceId)
        const params = [workspaceId, member.userId, member.displayName]
        const [summary, rows] = await Promise.all([
            this.entityManager.query<Array<RoomSummaryRow>>(OFFICE_ROOM_SUMMARY, params),
            this.entityManager.query<Array<RoomRow>>(LIST_ROOMS, params),
        ])
        const memberRows = await this.entityManager.query<Array<RoomMembersRow>>(LIST_ROOM_MEMBERS, [
            workspaceId,
            rows.map((row) => row.key),
        ])
        const roomMembers = new Map(memberRows.map((row) => [row.key, { count: row.count, preview: row.preview }]))
        const emptyMembers = { count: 0, preview: [] }
        const office: RoomView = {
            ...(summary[0] ?? EMPTY_SUMMARY),
            key: null,
            name: "",
            position: 0,
            agent_ids: [],
            home_agent_ids: [],
            user_ids: [],
            pins: [],
            members: roomMembers.get(null) ?? emptyMembers,
        }
        return [office, ...rows.map((row): RoomView => ({ ...row, members: roomMembers.get(row.key) ?? emptyMembers }))]
    }

    /** The caller's direct conversations: every agent with its unread count and newest line, and the unread customer ones. */
    async unread(principalId: string, workspaceId: string): Promise<ConversationUnreadListView> {
        const member = await this.members.require(principalId, workspaceId)
        const params = [workspaceId, member.userId, member.displayName]
        const [agents, leads] = await Promise.all([
            this.entityManager.query<Array<AgentConversationRow>>(LIST_AGENT_UNREAD, params),
            this.entityManager.query<Array<ConversationUnreadRow>>(LIST_LEAD_UNREAD, params),
        ])
        return { agents: agents.map(agentConversationOf), leads: withUnread(leads) }
    }

    /** Marks a direct conversation read by the caller up to now; a wrong kind or an id outside the workspace is refused. */
    async markConversationRead(principalId: string, workspaceId: string, kind: string, id: string): Promise<void> {
        const member = await this.members.require(principalId, workspaceId)
        const mark = markOf(kind)
        if (mark === undefined)
            throw new OfficeRoomsError({ code: OfficeRoomsErrorCode.ConversationInvalid, params: { id } })
        const rows = await this.entityManager.query<Array<unknown>>(mark, [workspaceId, member.userId, id])
        if (rows.length === 0)
            throw new OfficeRoomsError({ code: OfficeRoomsErrorCode.ConversationInvalid, params: { id } })
    }

    /** Marks a room (null = the Office room) read by the caller up to now. */
    async markRead(principalId: string, workspaceId: string, room: RoomChoice): Promise<void> {
        const member = await this.members.require(principalId, workspaceId)
        if (room !== null && !isOfficeRoomKey(room))
            throw new OfficeRoomsError({ code: OfficeRoomsErrorCode.RoomInvalid, params: { room } })
        await this.entityManager.query(MARK_ROOM_READ, [workspaceId, member.userId, room ?? OFFICE_READ_KEY])
    }

    /** Opens the six department rooms of the workspace and seats its active agents; running it again changes nothing. */
    async setup(principalId: string, workspaceId: string, locale: Locale): Promise<ReadonlyArray<RoomView>> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        const [row] = await this.entityManager.query<Array<OpenedRow>>(ENSURE_ROOMS, [workspaceId])
        const rooms = await this.rooms(principalId, workspaceId)
        if ((row?.opened ?? 0) > 0) await this.announce(workspaceId, rooms, locale)
        return rooms
    }

    /** Posts the NIVO note that the department rooms are open, in the Office room. */
    private async announce(workspaceId: string, rooms: ReadonlyArray<RoomView>, locale: Locale): Promise<void> {
        const names = rooms
            .filter((room) => room.key !== null)
            .map((room) => room.name)
            .join(", ")
        const title = this.catalog.get("officeRooms.openedTitle", {}, locale)
        await this.cards.post(
            { workspaceId },
            {
                room: null,
                agentId: null,
                authorName: "NIVO",
                body: title,
                leadId: null,
                workItemId: null,
                card: {
                    v: 1,
                    type: "handoff_note",
                    title,
                    body: this.catalog.get("officeRooms.openedBody", { names }, locale),
                },
            },
        )
    }
}
