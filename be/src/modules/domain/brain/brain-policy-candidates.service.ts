import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"

/** The installation key of a truth kept for the whole workspace (the unique indexes use the same). */
export const NO_INSTALLATION = "00000000-0000-0000-0000-000000000000"

/** The key of a truth as the SQL reads it: subject, attribute and instance (never null). */
export interface TruthKey {
    /** The subject key of the truth. */
    readonly subjectKey: string
    /** The attribute key of the truth. */
    readonly attribute: string
    /** The installation, `NO_INSTALLATION` for the whole workspace. */
    readonly installation: string
}

/** One page of candidate truths: the facts that hold them now (ids) and the key to go on after. */
export interface CandidatePage {
    /** The truths of the page, in key order. */
    readonly keys: ReadonlyArray<TruthKey>
    /** The ids of every fact in force or scheduled that holds one of them (a truth may have both). */
    readonly factIds: ReadonlyArray<string>
    /** The last key of the page (the keyset cursor of the next one), or null for an empty page. */
    readonly last: TruthKey | null
}

/** The facts a truth is held by: in force or scheduled, a value (not a retire), of a kind the derive pass judges. */
const HELD = `f.status IN ('active', 'scheduled') AND f.proposal_kind = 'set' AND f.subject_type NOT IN ('customer', 'person')`

/** A truth key of the row `f`, its installation made non-null as the indexes make it. */
const KEY_OF_F = `f.subject_key, f.attribute, COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid)`

/**
 * The candidate condition: the truth of `f` has NO open judgement bound to a fact that still holds it (at the version judged). That is a
 * truth never judged, a judgement retired, or one bound to a value that is no longer in force or scheduled (the next version after an
 * edit, a re-labelled truth). A truth whose open judgement is bound to its holding fact is settled and never read again.
 */
const UNSETTLED = `NOT EXISTS (
    SELECT 1 FROM public.brain_policies p
    JOIN public.brain_facts h ON h.workspace_id = p.workspace_id AND h.id = p.fact_id
    WHERE p.workspace_id = f.workspace_id AND p.subject_key = f.subject_key AND p.attribute = f.attribute
      AND COALESCE(p.installation_id, '${NO_INSTALLATION}'::uuid) = COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid)
      AND p.status = 'open' AND h.status IN ('active', 'scheduled') AND h.version IS NOT DISTINCT FROM p.fact_version)`

/** A raw key row. */
interface KeyRow {
    readonly subject_key: string
    readonly attribute: string
    readonly installation: string
}

const keyOf = (row: KeyRow): TruthKey => ({ subjectKey: row.subject_key, attribute: row.attribute, installation: row.installation })

@Injectable()
/**
 * The SQL reads of the policy layer at any size (BRAIN-LIMITS item 3). The derive pass selects ONLY the truths that need a look (no
 * judgement, or a judgement no longer bound to the fact that holds the truth) in keyset pages by truth key, on the partial index
 * `brain_facts_held_truth` (migration 20261112015400) and `brain_policies_truth`; it never reads every fact and plans in memory. A
 * page is three statements whatever the size of the workspace: this page, the facts by id, the judgements of its keys.
 */
export class BrainPolicyCandidatesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The next `limit` candidate truths after `after` (null: from the start), with the ids of the facts that hold them. */
    async page(workspaceId: string, after: TruthKey | null, limit: number): Promise<CandidatePage> {
        const rows: ReadonlyArray<KeyRow & { readonly id: string }> = await this.entityManager.query(
            `WITH keys AS (
                SELECT DISTINCT f.subject_key, f.attribute, COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid) AS installation
                FROM public.brain_facts f
                WHERE f.workspace_id = $1 AND ${HELD}
                  AND ($2::text IS NULL OR (${KEY_OF_F}) > ($2::text, $3::text, $4::uuid))
                  AND ${UNSETTLED}
                ORDER BY 1, 2, 3
                LIMIT $5
            )
            SELECT keys.subject_key, keys.attribute, keys.installation::text AS installation, f.id
            FROM keys
            JOIN public.brain_facts f
              ON f.workspace_id = $1 AND f.subject_key = keys.subject_key AND f.attribute = keys.attribute
             AND COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid) = keys.installation AND ${HELD}
            ORDER BY 1, 2, 3, 4`,
            [workspaceId, after?.subjectKey ?? null, after?.attribute ?? null, after?.installation ?? null, limit],
        )
        const keys = new Map<string, TruthKey>()
        for (const row of rows) keys.set(`${row.subject_key}\u0000${row.attribute}\u0000${row.installation}`, keyOf(row))
        const ordered = [...keys.values()]
        return { keys: ordered, factIds: rows.map((row) => row.id), last: ordered.at(-1) ?? null }
    }

    /**
     * How many truths in force or scheduled have NO judgement at all yet (the tab's "not judged yet"): one SQL count. A truth whose
     * judgement only has to follow it to a new value (a re-bind, no model call) is judged already and is not counted.
     */
    async unjudged(workspaceId: string): Promise<number> {
        const rows: ReadonlyArray<{ readonly n?: unknown }> = await this.entityManager.query(
            `SELECT count(DISTINCT (${KEY_OF_F}))::int AS n FROM public.brain_facts f
             WHERE f.workspace_id = $1 AND ${HELD} AND NOT EXISTS (
                SELECT 1 FROM public.brain_policies p
                WHERE p.workspace_id = f.workspace_id AND p.subject_key = f.subject_key AND p.attribute = f.attribute
                  AND COALESCE(p.installation_id, '${NO_INSTALLATION}'::uuid) = COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid))`,
            [workspaceId],
        )
        return Number(rows[0]?.n ?? 0)
    }

    /**
     * The waiting proposals of OTHER keys that name one of these facts as what they disagree with (a same-meaning proposal in other
     * words): the tab and the drawer count them as waiting on the truth, as they did over the workspace's window (`brain_facts_ws_proposal`).
     */
    async proposalsAgainst(workspaceId: string, factIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (factIds.length === 0) return []
        const rows: ReadonlyArray<{ readonly id: string }> = await this.entityManager.query(
            `SELECT f.id FROM public.brain_facts f WHERE f.workspace_id = $1 AND f.status = 'proposed' AND f.conflict_with = ANY($2::uuid[])`,
            [workspaceId, [...factIds]],
        )
        return rows.map((row) => row.id)
    }

    /** The ids of the facts of these truths in these statuses (one statement on `brain_facts_ws_subject`), for the policy tab. */
    async factIdsOf(
        workspaceId: string,
        keys: ReadonlyArray<TruthKey>,
        statuses: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> {
        if (keys.length === 0 || statuses.length === 0) return []
        const rows: ReadonlyArray<{ readonly id: string }> = await this.entityManager.query(
            `SELECT f.id FROM public.brain_facts f
             JOIN unnest($2::text[], $3::text[], $4::uuid[]) AS k(subject_key, attribute, installation)
               ON f.subject_key = k.subject_key AND f.attribute = k.attribute
              AND COALESCE(f.installation_id, '${NO_INSTALLATION}'::uuid) = k.installation
             WHERE f.workspace_id = $1 AND f.status = ANY($5::text[])`,
            [
                workspaceId,
                keys.map((key) => key.subjectKey),
                keys.map((key) => key.attribute),
                keys.map((key) => key.installation),
                [...statuses],
            ],
        )
        return rows.map((row) => row.id)
    }
}
