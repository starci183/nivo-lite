import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AgentConversationFacts, ConversationUnreadFacts, RoomFacts, RoomSummaryFacts } from "./office-rooms.facts"
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
/** The caller's own lines are recognised by account id, and by display name only on legacy lines that carry no account id. */
const NOT_OWN_LINE =
    "m.author_user_id IS DISTINCT FROM :userId AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = :displayName)"
/** The text shape the room reads answer for a timestamp: the database JSON rendering, ISO 8601 with an offset. */
const JSON_INSTANT = "to_json(m.created_at) #>> '{}'"
/** Before any marker exists every line is unread. */
const READ_AT = "COALESCE(rd.last_read_at, '-infinity'::timestamptz)"

/** Lines written after the instant the expression gives that the caller did not write. */
const unreadLines = (readAt: string): string => `m.created_at > ${readAt} AND ${NOT_OWN_LINE}`

@Injectable()
/** The room list reads: unread counts, newest lines, seats and pins, scoped to one caller in one workspace. */
export class OfficeRoomReadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The general Office room as the list shows it: every line of the workspace, read from the caller's `''` marker. */
    summary(workspaceId: string, userId: string, displayName: string): Promise<RoomSummaryFacts | undefined> {
        const query = this.entityManager.createQueryBuilder()
        const marker = query
            .subQuery()
            .select("rd.last_read_at")
            .from(OfficeRoomReadEntity, "rd")
            .where("rd.workspace_id = :workspaceId AND rd.user_id = :userId AND rd.room = ''")
            .limit(1)
            .getQuery()
        const lines = unreadLines(`COALESCE(${marker}, '-infinity'::timestamptz)`)
        const count = query
            .subQuery()
            .select("count(*)")
            .from("public.messages", "m")
            .where("m.workspace_id = :workspaceId")
            .andWhere(lines)
            .getQuery()
        const mentions = query
            .subQuery()
            .select("array_agg(DISTINCT m.body)")
            .from("public.messages", "m")
            .where("m.workspace_id = :workspaceId")
            .andWhere(lines)
            .andWhere("strpos(m.body, '@') > 0")
            .getQuery()
        const newest = (select: string): string =>
            query
                .subQuery()
                .select(select)
                .from("public.messages", "m")
                .where("m.workspace_id = :workspaceId")
                .orderBy("m.created_at", "DESC")
                .addOrderBy("m.id", "DESC")
                .limit(1)
                .getQuery()
        return query
            .select(`LEAST(99, ${count})::int`, "unread")
            .addSelect(`COALESCE(${mentions}, '{}'::text[])`, "unread_mention_bodies")
            .addSelect(newest("m.body"), "last_body")
            .addSelect(newest("m.author_name"), "last_author")
            .addSelect(newest("m.author_user_id::text"), "last_author_user_id")
            .addSelect(newest(JSON_INSTANT), "last_at")
            .from("public.workspaces", "ws")
            .where("ws.id = :workspaceId")
            .setParameters({ workspaceId, userId, displayName })
            .getRawOne<RoomSummaryFacts>()
    }

    /** The department rooms of a workspace with the caller's unread count, newest line, seats and pins. */
    rooms(workspaceId: string, userId: string, displayName: string): Promise<Array<RoomFacts>> {
        const query = this.entityManager.createQueryBuilder(OfficeRoomEntity, "r")
        const ofRoom = "m.workspace_id = r.workspace_id AND m.room = r.key"
        const count = query
            .subQuery()
            .select("count(*)")
            .from("public.messages", "m")
            .where(ofRoom)
            .andWhere(unreadLines(READ_AT))
            .getQuery()
        const mentions = query
            .subQuery()
            .select("array_agg(DISTINCT m.body)")
            .from("public.messages", "m")
            .where(ofRoom)
            .andWhere(unreadLines(READ_AT))
            .andWhere("strpos(m.body, '@') > 0")
            .getQuery()
        const newest = (select: string): string =>
            query
                .subQuery()
                .select(select)
                .from("public.messages", "m")
                .where(ofRoom)
                .orderBy("m.created_at", "DESC")
                .addOrderBy("m.id", "DESC")
                .limit(1)
                .getQuery()
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
        return query
            .select("r.key", "key")
            .addSelect("r.name", "name")
            .addSelect("r.position", "position")
            .addSelect(`LEAST(99, ${count})::int`, "unread")
            .addSelect(`COALESCE(${mentions}, '{}'::text[])`, "unread_mention_bodies")
            .addSelect(newest("m.body"), "last_body")
            .addSelect(newest("m.author_name"), "last_author")
            .addSelect(newest("m.author_user_id::text"), "last_author_user_id")
            .addSelect(newest(JSON_INSTANT), "last_at")
            .addSelect(`COALESCE(${seats("agent_id", "")}, '{}'::text[])`, "agent_ids")
            .addSelect(`COALESCE(${seats("agent_id", " AND rm.is_home")}, '{}'::text[])`, "home_agent_ids")
            .addSelect(`COALESCE(${seats("user_id", "")}, '{}'::text[])`, "user_ids")
            .addSelect(`COALESCE(${pins}, '[]'::json)`, "pins")
            .leftJoin(
                OfficeRoomReadEntity,
                "rd",
                "rd.workspace_id = r.workspace_id AND rd.user_id = :userId AND rd.room = r.key",
            )
            .where("r.workspace_id = :workspaceId")
            .orderBy("r.position")
            .addOrderBy("r.key")
            .limit(ROOM_LIMIT)
            .setParameters({ workspaceId, userId, displayName })
            .getRawMany<RoomFacts>()
    }

    /** Every agent of the workspace with the caller's unread line count of its test chats and the newest line. */
    agentConversations(
        workspaceId: string,
        userId: string,
        displayName: string,
    ): Promise<Array<AgentConversationFacts>> {
        const query = this.entityManager.createQueryBuilder()
        const ofAgent = "m.workspace_id = a.workspace_id AND c.agent_id = a.id AND c.kind = 'test'"
        const chat = (select: string) =>
            query
                .subQuery()
                .select(select)
                .from("public.agent_messages", "m")
                .innerJoin("agent_conversations", "c", "c.id = m.conversation_id AND c.workspace_id = m.workspace_id")
        const count = chat("count(*)").where(ofAgent).andWhere(unreadLines(READ_AT)).getQuery()
        const newest = (select: string): string =>
            chat(select)
                .leftJoin(
                    "workspace_members",
                    "wm",
                    "wm.workspace_id = m.workspace_id AND wm.user_id = m.author_user_id",
                )
                .where(ofAgent)
                .orderBy("m.created_at", "DESC")
                .addOrderBy("m.id", "DESC")
                .limit(1)
                .getQuery()
        return query
            .select("a.id::text", "id")
            .addSelect(`LEAST(99, ${count})::int`, "unread")
            .addSelect(newest("m.body"), "last_body")
            .addSelect(newest("m.author_user_id::text"), "last_author_id")
            .addSelect(newest("COALESCE(m.author_name, wm.display_name)"), "last_author")
            .addSelect(newest(JSON_INSTANT), "last_at")
            .from("public.agents", "a")
            .leftJoin(
                OfficeRoomReadEntity,
                "rd",
                "rd.workspace_id = a.workspace_id AND rd.user_id = :userId AND rd.room = 'agent:' || a.id::text",
            )
            .where("a.workspace_id = :workspaceId")
            .orderBy("a.id")
            .limit(AGENT_LIMIT)
            .setParameters({ workspaceId, userId, displayName })
            .getRawMany<AgentConversationFacts>()
    }

    /** The caller's unread line counts of every lead of the workspace. */
    leadConversations(
        workspaceId: string,
        userId: string,
        displayName: string,
    ): Promise<Array<ConversationUnreadFacts>> {
        const query = this.entityManager.createQueryBuilder()
        const count = query
            .subQuery()
            .select("count(*)")
            .from("public.messages", "m")
            .where("m.workspace_id = l.workspace_id AND m.lead_id = l.id")
            .andWhere(unreadLines(READ_AT))
            .getQuery()
        return query
            .select("l.id::text", "id")
            .addSelect(`LEAST(99, ${count})::int`, "unread")
            .from("public.leads", "l")
            .leftJoin(
                OfficeRoomReadEntity,
                "rd",
                "rd.workspace_id = l.workspace_id AND rd.user_id = :userId AND rd.room = 'lead:' || l.id::text",
            )
            .where("l.workspace_id = :workspaceId")
            .orderBy("l.id")
            .limit(LEAD_LIMIT)
            .setParameters({ workspaceId, userId, displayName })
            .getRawMany<ConversationUnreadFacts>()
    }
}
