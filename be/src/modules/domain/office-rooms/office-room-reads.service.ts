import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { MessagesReadService } from "@modules/domain/messages"
import type { LineReader } from "@modules/domain/messages"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectRoomsAgents, InjectRoomsTestChats } from "./office-rooms.decorators"
import type { RoomsAgentChats, RoomsAgents, RoomsChatLine, RoomsTestChats } from "./office-rooms.port"
import type {
    AgentConversationFacts,
    ConversationUnreadFacts,
    RoomFacts,
    RoomSummaryFacts,
} from "./office-rooms.contracts"
import {
    OfficeRoomEntity,
    OfficeRoomMemberEntity,
    OfficeRoomPinEntity,
    OfficeRoomReadEntity,
} from "./persistence/entities"

/** How many department rooms the list answers. */
const ROOM_LIMIT = 20
/** How many agent conversations the unread read answers. */
const AGENT_LIMIT = 100
/** How many customer conversations the unread read answers. */
const LEAD_LIMIT = 500
/** The read marker key prefixes of the direct conversations. */
const AGENT_KEY = "agent:"
const LEAD_KEY = "lead:"
/** The text shape a marker instant is read in: the database JSON rendering, microsecond exact. */
const MARK_INSTANT = "to_json(rd.last_read_at) #>> '{}'"

/** One marker row: the key it was written for and the instant, as text. */
interface MarkRaw {
    readonly room: string
    readonly read_at: string
}

/** One room row before its lines are attached. */
type RoomRaw = Omit<RoomFacts, keyof RoomSummaryFacts> & { readonly read_at: string | null }

/** A room nobody wrote in. */
const SILENT: RoomSummaryFacts = {
    unread: 0,
    unread_mention_bodies: [],
    last_body: null,
    last_author: null,
    last_author_user_id: null,
    last_at: null,
}

@Injectable()
/** The room list reads: unread counts, newest lines, seats and pins, scoped to one caller in one workspace. */
export class OfficeRoomReadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly messages: MessagesReadService,
        @InjectRoomsAgents() private readonly agents: RoomsAgents,
        @InjectRoomsTestChats() private readonly testChats: RoomsTestChats,
        private readonly members: WorkspaceMembersReadService,
    ) {}

    /** The general Office room as the list shows it: every line of the workspace, read from the caller's `''` marker. */
    async summary(workspaceId: string, userId: string, displayName: string): Promise<RoomSummaryFacts> {
        const [mark] = await this.marksOf(workspaceId, userId, "rd.room = ''")
        return this.messages.activityOfWorkspace(workspaceId, { userId, displayName }, mark?.read_at ?? null)
    }

    /** The department rooms of a workspace with the caller's unread count, newest line, seats and pins. */
    async rooms(workspaceId: string, userId: string, displayName: string): Promise<Array<RoomFacts>> {
        const query = this.entityManager.createQueryBuilder(OfficeRoomEntity, "r")
        const seats = (column: string, extra: string): string =>
            query
                .subQuery()
                .select(`array_agg(rm.${column}::text ORDER BY rm.created_at)`)
                .from(OfficeRoomMemberEntity, "rm")
                .where(`rm.room_id = r.id AND rm.${column} IS NOT NULL${extra}`)
                .getQuery()
        const pins = query
            .subQuery()
            .select(
                "json_agg(json_build_object('id', p.id, 'title', p.title, 'href', p.href, 'note', p.note) ORDER BY p.created_at)",
            )
            .from(OfficeRoomPinEntity, "p")
            .where("p.room_id = r.id")
            .getQuery()
        const rows = await query
            .select("r.key", "key")
            .addSelect("r.name", "name")
            .addSelect("r.position", "position")
            .addSelect(`COALESCE(${seats("agent_id", "")}, '{}'::text[])`, "agent_ids")
            .addSelect(`COALESCE(${seats("agent_id", " AND rm.is_home")}, '{}'::text[])`, "home_agent_ids")
            .addSelect(`COALESCE(${seats("user_id", "")}, '{}'::text[])`, "user_ids")
            .addSelect(`COALESCE(${pins}, '[]'::json)`, "pins")
            .addSelect(MARK_INSTANT, "read_at")
            .leftJoin(
                OfficeRoomReadEntity,
                "rd",
                "rd.workspace_id = r.workspace_id AND rd.user_id = :userId AND rd.room = r.key",
            )
            .where("r.workspace_id = :workspaceId")
            .orderBy("r.position")
            .addOrderBy("r.key")
            .limit(ROOM_LIMIT)
            .setParameters({ workspaceId, userId })
            .getRawMany<RoomRaw>()
        const activity = await this.messages.activityOfRooms(
            workspaceId,
            { userId, displayName },
            rows.map((row) => ({ key: row.key, readAt: row.read_at })),
        )
        return rows.map((row): RoomFacts => ({
            ...(activity.get(row.key) ?? SILENT),
            key: row.key,
            name: row.name,
            position: row.position,
            agent_ids: row.agent_ids,
            home_agent_ids: row.home_agent_ids,
            user_ids: row.user_ids,
            pins: row.pins,
        }))
    }

    /** Every agent of the workspace with the caller's unread line count of its test chats and the newest line. */
    async agentConversations(
        workspaceId: string,
        userId: string,
        displayName: string,
    ): Promise<Array<AgentConversationFacts>> {
        const agentIds = await this.agents.idsOf(workspaceId, AGENT_LIMIT)
        const marks = new Map(
            (await this.marksOf(workspaceId, userId, "rd.room LIKE 'agent:%'")).map((mark) => [
                mark.room,
                mark.read_at,
            ]),
        )
        const chats = await this.testChats.activityOf(
            workspaceId,
            { userId, displayName },
            agentIds.map((agentId) => ({ agentId, readAt: marks.get(`${AGENT_KEY}${agentId}`) ?? null })),
        )
        const authors = await this.members.namesOf(
            workspaceId,
            chats.flatMap(({ newest }) => (newest?.author_user_id ? [newest.author_user_id] : [])),
        )
        const names = new Map(authors.map((author) => [author.userId, author.displayName]))
        return chats.map((chat): AgentConversationFacts => conversationFactsOf(chat, names))
    }

    /** The caller's unread line counts of the customer conversations that have unread lines. */
    async leadConversations(
        workspaceId: string,
        userId: string,
        displayName: string,
    ): Promise<Array<ConversationUnreadFacts>> {
        const marks = await this.marksOf(workspaceId, userId, "rd.room LIKE 'lead:%'")
        const reader: LineReader = { userId, displayName }
        const unread = await this.messages.unreadOfLeads(
            workspaceId,
            reader,
            marks.map((mark) => ({ key: mark.room.slice(LEAD_KEY.length), readAt: mark.read_at })),
            LEAD_LIMIT,
        )
        return unread.map((entry) => ({ id: entry.lead_id, unread: entry.unread }))
    }

    /** The caller's read markers of the workspace whose key matches the condition, with the instant as exact text. */
    private marksOf(workspaceId: string, userId: string, condition: string): Promise<Array<MarkRaw>> {
        return this.entityManager
            .createQueryBuilder(OfficeRoomReadEntity, "rd")
            .select("rd.room", "room")
            .addSelect(MARK_INSTANT, "read_at")
            .where("rd.workspace_id = :workspaceId AND rd.user_id = :userId", { workspaceId, userId })
            .andWhere(condition)
            .getRawMany<MarkRaw>()
    }
}

/** The name a line shows for its author: the name written on the line, else the member's display name. */
const authorOf = (newest: RoomsChatLine, names: ReadonlyMap<string, string>): string | null => {
    if (newest.author_name !== null) return newest.author_name
    return newest.author_user_id === null ? null : (names.get(newest.author_user_id) ?? null)
}

/** One agent's direct conversation from the activity of its test chats. */
const conversationFactsOf = (chat: RoomsAgentChats, names: ReadonlyMap<string, string>): AgentConversationFacts => ({
    id: chat.agentId,
    unread: chat.unread,
    last_body: chat.newest?.body ?? null,
    last_author_id: chat.newest?.author_user_id ?? null,
    last_author: chat.newest === undefined ? null : authorOf(chat.newest, names),
    last_at: chat.newest?.at ?? null,
})
