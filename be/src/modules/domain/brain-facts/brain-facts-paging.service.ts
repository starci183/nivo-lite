import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BrainSubjectType, FactRecord, FactStatus } from "./brain-facts.contracts"
import { toFactRecord } from "./fact-record.mapper"
import { BrainFactEntity } from "./persistence/entities"

/** The most facts one page answers. */
export const FACTS_PAGE_MAX = 2000

/** The statuses the Second Brain page lists when the caller names none. */
export const PAGE_STATUSES: ReadonlyArray<FactStatus> = ["active", "proposed", "scheduled"]

/** The most words of a search that filter a page. */
const SEARCH_WORDS_MAX = 8

/** What a page of facts is filtered by: every field is optional and ANDed. */
export interface FactPageFilter {
    /** Only these statuses (default: in force, waiting and scheduled). */
    readonly statuses?: ReadonlyArray<FactStatus> | undefined
    /** Only facts that cite this document in their evidence. */
    readonly sourceId?: string | null | undefined
    /** Only this kind of subject. */
    readonly subjectType?: BrainSubjectType | null | undefined
    /** Only facts whose subject, attribute or value hold EVERY word (accents ignored). */
    readonly search?: string | null | undefined
}

/** One page of facts, newest change first, with the cursor of the next page and the count of all that match. */
export interface FactPage {
    /** The facts of the page. */
    readonly facts: ReadonlyArray<FactRecord>
    /** The cursor of the next page, or null when this is the last. */
    readonly nextCursor: string | null
    /** How many facts match the filter in all (an SQL count, never the length of a window). */
    readonly total: number
}

/** The position after a row: its change instant (as PostgreSQL wrote it, microseconds kept) and its id. */
interface Position {
    readonly at: string
    readonly id: string
}

/** A cursor as a caller holds it: its text, or none. */
export type CursorText = string | null | undefined

/** The position a cursor names, or null when it names none. */
export type PositionLookup = Position | null

/** A cursor as the caller holds it: opaque base64url of the position. */
export const cursorOf = (position: Position): string =>
    Buffer.from(`${position.at}|${position.id}`, "utf8").toString("base64url")

/** The position a cursor names, or null when it is not one of ours. */
export const positionOf = (cursor: CursorText): PositionLookup => {
    if (cursor === null || cursor === undefined || cursor === "") return null
    const text = Buffer.from(cursor, "base64url").toString("utf8")
    const bar = text.lastIndexOf("|")
    if (bar <= 0) return null
    const at = text.slice(0, bar)
    const id = text.slice(bar + 1)
    return Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/u.test(id) ? null : { at, id }
}

/** The words of a search, folded by the database, at most `SEARCH_WORDS_MAX`. */
const wordsOf = (search: string | null | undefined): ReadonlyArray<string> =>
    (search ?? "")
        .split(/\s+/u)
        .map((word) => word.trim())
        .filter((word) => word !== "")
        .slice(0, SEARCH_WORDS_MAX)

@Injectable()
/**
 * The Second Brain page's facts at any size (BRAIN-LIMITS item 4): keyset pages ordered by (updated_at DESC, id DESC) over the partial
 * index `brain_facts_page` (migration 20261112015400), the filters in SQL, and the total by SQL `count`. A page is at most THREE
 * statements whatever the size of the workspace: the page, its count, and the exact instant of its last row for the cursor.
 */
export class BrainFactsPagingService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One page after `after` (null: the first), at most `first` facts (capped at `FACTS_PAGE_MAX`), and the count of all that match. */
    async page(workspaceId: string, filter: FactPageFilter, first: number, after: CursorText): Promise<FactPage> {
        const limit = Math.max(1, Math.min(Math.floor(first), FACTS_PAGE_MAX))
        const position = positionOf(after)
        const rows = this.filtered(workspaceId, filter)
            .andWhere(
                position === null ? "TRUE" : "(f.updated_at, f.id) < (CAST(:at AS timestamptz), CAST(:id AS uuid))",
                {
                    at: position?.at,
                    id: position?.id,
                },
            )
            .orderBy("f.updated_at", "DESC")
            .addOrderBy("f.id", "DESC")
            .limit(limit + 1)
        const [entities, total] = await Promise.all([rows.getMany(), this.count(workspaceId, filter)])
        const shown = entities.slice(0, limit)
        const last = shown.at(-1)
        const more = entities.length > limit && last !== undefined
        // The cursor keeps the change instant exactly as PostgreSQL holds it (microseconds; a JS date would drop them and skip rows).
        const at = more ? await this.instantOf(workspaceId, last.id) : null
        return {
            facts: shown.map((row) => toFactRecord(row)),
            nextCursor: more && at !== null ? cursorOf({ at, id: last.id }) : null,
            total,
        }
    }

    /** The change instant of one fact as text, microseconds kept (primary key). */
    private async instantOf(workspaceId: string, id: string): Promise<string | null> {
        const row = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.updated_at::text", "at")
            .where("f.workspaceId = :workspaceId AND f.id = :id", { workspaceId, id })
            .getRawOne<{ at: string }>()
        return row?.at ?? null
    }

    /** How many facts match the filter: one SQL count. */
    count(workspaceId: string, filter: FactPageFilter): Promise<number> {
        return this.filtered(workspaceId, filter).getCount()
    }

    /** How many facts of the workspace are in each of these statuses (one grouped count on `brain_facts_ws_status`). */
    async countByStatus(
        workspaceId: string,
        statuses: ReadonlyArray<FactStatus>,
    ): Promise<ReadonlyMap<FactStatus, number>> {
        if (statuses.length === 0) return new Map()
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.status", "status")
            .addSelect("COUNT(*)::int", "count")
            .where("f.workspaceId = :workspaceId AND f.status IN (:...statuses)", {
                workspaceId,
                statuses: [...statuses],
            })
            .groupBy("f.status")
            .getRawMany<{ status: FactStatus; count: number | string }>()
        return new Map(rows.map((row) => [row.status, Number(row.count)]))
    }

    /** The facts of the workspace that match the filter, as a query to page or count. */
    private filtered(workspaceId: string, filter: FactPageFilter): SelectQueryBuilder<BrainFactEntity> {
        const statuses = filter.statuses !== undefined && filter.statuses.length > 0 ? filter.statuses : PAGE_STATUSES
        const query = this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where("f.workspaceId = :workspaceId AND f.status IN (:...statuses)", {
                workspaceId,
                statuses: [...statuses],
            })
        if (filter.subjectType !== null && filter.subjectType !== undefined) {
            query.andWhere("f.subjectType = :subjectType", { subjectType: filter.subjectType })
        }
        if (filter.sourceId !== null && filter.sourceId !== undefined && filter.sourceId !== "") {
            query.andWhere(
                "EXISTS (SELECT 1 FROM jsonb_array_elements(f.evidence) AS e WHERE e->>'kind' = 'document' AND coalesce(e->>'sourceId', e->>'ref') = :sourceId)",
                { sourceId: filter.sourceId },
            )
        }
        wordsOf(filter.search).forEach((word, index) => {
            query.andWhere(
                `public.knowledge_fold(f.subject_label || ' ' || f.attribute_label || ' ' || f.value) LIKE '%' || public.knowledge_fold(:word${String(index)}) || '%'`,
                { [`word${String(index)}`]: word },
            )
        })
        return query
    }
}
