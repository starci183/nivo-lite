import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    LeadUnread,
    LineActivity,
    LinePageQuery,
    LineReader,
    LineText,
    OptionalLineText,
    ReadInstant,
    ReadMark,
    ThreadLine,
} from "./messages-read.contracts"
import { MessageEntity } from "./persistence/entities"

/** The caller's own lines are recognised by account id, and by display name only on legacy lines that carry no account id. */
const NOT_OWN_LINE =
    "m.author_user_id IS DISTINCT FROM :userId AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = :displayName)"
/** The text shape the reads answer for a timestamp: the database JSON rendering, ISO 8601 with an offset. */
const JSON_INSTANT = "to_json(m.created_at) #>> '{}'"
/** Before any marker exists every line is unread. */
const NEVER_READ = "'-infinity'::timestamptz"

/** The unread count and mentions of one conversation as the grouped read selects them. */
interface UnreadRaw {
    readonly scope: string
    readonly unread: number
    readonly mentions: Array<string> | null
}

/** The newest line of one room as the read selects it. */
interface NewestRaw {
    readonly room: string | null
    readonly last_body: string
    readonly last_author: string
    readonly last_author_user_id: string | null
    readonly last_at: string
}

/** The columns of the newest line a read answers. */
const NEWEST_COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ["m.body", "last_body"],
    ["m.author_name", "last_author"],
    ["m.author_user_id::text", "last_author_user_id"],
    [JSON_INSTANT, "last_at"],
]

/** The activity of a conversation from its unread facts and newest line; a conversation without lines is quiet. */
const activityOf = (unread: UnreadRaw | undefined, newest: NewestRaw | undefined): LineActivity => ({
    unread: unread?.unread ?? 0,
    unread_mention_bodies: unread?.mentions ?? [],
    last_body: newest?.last_body ?? null,
    last_author: newest?.last_author ?? null,
    last_author_user_id: newest?.last_author_user_id ?? null,
    last_at: newest?.last_at ?? null,
})

@Injectable()
/** Request-time reads of the Office thread for other capabilities: unread counts, newest lines and thread pages. */
export class MessagesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every line of the workspace as one conversation: unread since `readAt`, and the newest line. */
    async activityOfWorkspace(workspaceId: string, reader: LineReader, readAt: ReadInstant): Promise<LineActivity> {
        const unread = await this.entityManager
            .createQueryBuilder(MessageEntity, "m")
            .select("LEAST(99, count(*))::int", "unread")
            .addSelect("array_agg(DISTINCT m.body) FILTER (WHERE strpos(m.body, '@') > 0)", "mentions")
            .where("m.workspace_id = :workspaceId", { workspaceId })
            .andWhere(`m.created_at > COALESCE(CAST(:readAt AS timestamptz), ${NEVER_READ})`, { readAt })
            .andWhere(NOT_OWN_LINE, reader)
            .getRawOne<UnreadRaw>()
        const newest = await this.newestOf(workspaceId)
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(1)
            .getRawOne<NewestRaw>()
        return activityOf(unread, newest)
    }

    /** Each given room: unread since its mark, and its newest line. A room without a line answers the quiet activity. */
    async activityOfRooms(
        workspaceId: string,
        reader: LineReader,
        marks: ReadonlyArray<ReadMark>,
    ): Promise<ReadonlyMap<string, LineActivity>> {
        if (marks.length === 0) return new Map()
        const rooms = marks.map((mark) => mark.key)
        const unread = await this.unreadBy("m.room", workspaceId, reader, marks)
            .andWhere("m.room IN (:...rooms)", { rooms })
            .getRawMany<UnreadRaw>()
        const newest = await this.newestOf(workspaceId)
            .distinctOn(["m.room"])
            .andWhere("m.room IN (:...rooms)", { rooms })
            .orderBy("m.room")
            .addOrderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .getRawMany<NewestRaw>()
        const unreadOf = new Map(unread.map((row) => [row.scope, row]))
        const newestOf = new Map(newest.map((row) => [row.room, row]))
        return new Map(rooms.map((room) => [room, activityOf(unreadOf.get(room), newestOf.get(room))]))
    }

    /** The customer conversations with lines the caller has not read, in lead order, bounded. */
    async unreadOfLeads(
        workspaceId: string,
        reader: LineReader,
        marks: ReadonlyArray<ReadMark>,
        limit: number,
    ): Promise<Array<LeadUnread>> {
        const rows = await this.unreadBy("m.lead_id", workspaceId, reader, marks)
            .andWhere("m.lead_id IS NOT NULL")
            .orderBy("m.lead_id")
            .limit(limit)
            .getRawMany<UnreadRaw>()
        return rows.map((row) => ({ lead_id: row.scope, unread: row.unread }))
    }

    /** One page of the thread, newest first: one line more than asked, so the caller can tell whether an older page exists. */
    page(workspaceId: string, query: LinePageQuery): Promise<Array<ThreadLine>> {
        const page = this.entityManager
            .createQueryBuilder(MessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.author_kind", "author_kind")
            .addSelect("m.author_name", "author_name")
            .addSelect("m.author_user_id::text", "author_user_id")
            .addSelect("m.agent_id", "agent_id")
            .addSelect("m.staff_id", "staff_id")
            .addSelect("m.body", "body")
            .addSelect("m.lead_id", "lead_id")
            .addSelect("m.work_item_id", "work_item_id")
            .addSelect("m.room", "room")
            .addSelect("m.card::text", "card_json")
            .addSelect(JSON_INSTANT, "created_at")
            .where("m.workspace_id = :workspaceId", { workspaceId })
        if (query.room !== null) page.andWhere("m.room = :room", { room: query.room })
        if (query.before !== null)
            page.andWhere("(m.created_at, m.id) < (CAST(:beforeAt AS timestamptz), CAST(:beforeId AS uuid))", {
                beforeAt: query.before.createdAt,
                beforeId: query.before.id,
            })
        return page
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(query.size + 1)
            .getRawMany<ThreadLine>()
    }

    /** The author and text of one message of the workspace; undefined when there is none. */
    textOf(workspaceId: string, messageId: string): Promise<OptionalLineText> {
        return this.entityManager
            .createQueryBuilder(MessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.author_kind", "author_kind")
            .addSelect("m.body", "body")
            .where("m.workspace_id = :workspaceId AND m.id = :messageId", { workspaceId, messageId })
            .limit(1)
            .getRawOne<LineText>()
    }

    /** The lines of the workspace the caller did not write and has not read, grouped by the column that names the conversation. */
    private unreadBy(
        column: "m.room" | "m.lead_id",
        workspaceId: string,
        reader: LineReader,
        marks: ReadonlyArray<ReadMark>,
    ): SelectQueryBuilder<MessageEntity> {
        const markedAt = `(SELECT t.read_at FROM unnest(CAST(:markScopes AS text[]), CAST(:markReadAts AS timestamptz[])) AS t(scope, read_at) WHERE t.scope = ${column}::text)`
        return this.entityManager
            .createQueryBuilder(MessageEntity, "m")
            .select(`${column}::text`, "scope")
            .addSelect("LEAST(99, count(*))::int", "unread")
            .addSelect("array_agg(DISTINCT m.body) FILTER (WHERE strpos(m.body, '@') > 0)", "mentions")
            .where("m.workspace_id = :workspaceId", { workspaceId })
            .andWhere(`m.created_at > COALESCE(${markedAt}, ${NEVER_READ})`, {
                markScopes: marks.map((mark) => mark.key),
                markReadAts: marks.map((mark) => mark.readAt),
            })
            .andWhere(NOT_OWN_LINE, reader)
            .groupBy(column)
    }

    /** The newest-line columns of the workspace's messages, ready to be filtered and ordered. */
    private newestOf(workspaceId: string): SelectQueryBuilder<MessageEntity> {
        const query = this.entityManager
            .createQueryBuilder(MessageEntity, "m")
            .select("m.room", "room")
            .where("m.workspace_id = :workspaceId", { workspaceId })
        for (const [expression, alias] of NEWEST_COLUMNS) query.addSelect(expression, alias)
        return query
    }
}
