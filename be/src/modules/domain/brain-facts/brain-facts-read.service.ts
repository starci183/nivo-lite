import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    FactAudience,
    FactFilter,
    FactRecord,
    FactStatus,
    InstallationScope,
    MaybeFact,
} from "./brain-facts.contracts"
import { factKeyOf } from "./fact-columns.policy"
import { factSlugOf } from "./fact-key.policy"
import { toFactRecord } from "./fact-record.mapper"
import { hybridFacts, inForce, searchFacts, unshadowed, visibleTo, type RankedFact } from "./fact-view.policy"
import { IN_FORCE_BYTES, IN_FORCE_STATUSES, type InForceCount, type InForceHeld } from "./in-force.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most facts a list returns. */
const LIST_MAX = 2000

/** The newest facts of a view a search ranks in memory beside its word and vector hits. */
const SEARCH_WINDOW = 500

/** The most facts the word prefilter answers for one question, best word match first. */
export const WORD_HITS_MAX = 200

/** The most other values of the same truths one served set reads (in force, scheduled or waiting). */
const KIN_MAX = 200

/**
 * The words of a fact as the database folds them, the SAME text the in-memory score reads (`searchFacts` / `hybridFacts`: the subject
 * key, the attribute key and the value's slug): `knowledge_fold` (lower case, unaccent, so an accented word and its plain form are one word),
 * every run of other characters one space, one `simple` lexeme per word. Migration 20261112015200 indexes exactly this expression (GIN,
 * partial on the statuses below): a change here needs a new index.
 */
export const FACT_WORDS_SQL =
    "to_tsvector('simple'::regconfig, regexp_replace(public.knowledge_fold(f.subject_key || ' ' || f.attribute || ' ' || f.value), '[^a-z0-9]+', ' ', 'g'))"

/** The statuses the word index holds, as its partial predicate reads them. */
export const FACT_WORDS_STATUSES_SQL = "f.status IN ('active', 'scheduled')"

/** The words of a question as the word prefilter asks them: the in-memory score's words (two letters or more), any of them. */
export const questionWordsOf = (query: string): ReadonlyArray<string> => [
    ...new Set(
        factSlugOf(query)
            .split("-")
            .filter((word) => word.length > 1),
    ),
]

/** The facts of the same truths as some served facts: the keys to read, and the ids a same-meaning proposal may name. */
export interface KinQuery {
    /** The truths (subject key, attribute). */
    readonly keys: ReadonlyArray<{ readonly subjectKey: string; readonly attribute: string }>
    /** The served facts: a waiting proposal flagged as possibly the same truth names one of them in `conflictWith`. */
    readonly ids: ReadonlyArray<string>
}

@Injectable()
/** The read side of the facts: one fact, a list, the facts of a key, and what one agent may use or find right now. */
export class BrainFactsReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** One fact of the workspace. */
    get(workspaceId: string, id: string): Promise<MaybeFact> {
        return this.fetch(this.entityManager, workspaceId, id)
    }

    /** The facts of the workspace, newest change first. */
    async list(workspaceId: string, filter: FactFilter): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: {
                workspaceId,
                ...(filter.statuses === undefined ? {} : { status: In(filter.statuses) }),
                ...(filter.subjectKey === undefined ? {} : { subjectKey: filter.subjectKey }),
            },
            order: { updatedAt: "DESC" },
            take: Math.min(filter.limit ?? 500, LIST_MAX),
        })
        return rows.map((row) => toFactRecord(row))
    }

    /** The facts kept for one agent instance alone (never the shared ones) in the given statuses, oldest first. */
    async ofInstance(
        workspaceId: string,
        installationId: string,
        statuses: ReadonlyArray<FactStatus>,
    ): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, installationId, status: In([...statuses]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: LIST_MAX,
        })
        return rows.map((row) => toFactRecord(row))
    }

    /**
     * How many cards of the owner's review the proposals waiting in the workspace make: one card per key (subject and attribute), the rule
     * of `waitingCardCount`, counted by ONE SQL `count(DISTINCT key)` on `brain_facts_ws_proposal`, exact at any number of proposals
     * (BRAIN-LIMITS item 4; it read at most 5,000 rows before and undercounted above).
     */
    async waitingCards(workspaceId: string): Promise<number> {
        const row = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("COUNT(DISTINCT (f.subject_key, f.attribute))::int", "cards")
            .where("f.workspaceId = :workspaceId AND f.status = :status", { workspaceId, status: "proposed" })
            .getRawOne<{ cards: number | string }>()
        return Number(row?.cards ?? 0)
    }

    /** The facts of a key in one status and scope. */
    byKey(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.keyed(this.entityManager, workspaceId, subjectKey, attribute, status, installationId)
    }

    /**
     * The facts one agent may use right now: in force and inside its view. A scheduled value whose start has come is in force although
     * the upkeep (`maintain`, run when the brain is read on its page or a change is filed) has not promoted it yet: the value it replaces
     * ended at that same start on approval, so exactly one value of a key is in force at every instant, with no gap (FX5, D-P11-8b).
     * Where two values of one truth are still both in force (a value edited now while a scheduled one waited: § 0 Q3 of the brain test
     * plan), the started scheduled one shadows it, as the upkeep will; an instance's own value shadows the workspace-wide one for that
     * agent (`unshadowed`).
     */
    async forView(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const active = await this.list(workspaceId, { statuses: ["active", "scheduled"], limit })
        return this.inView(active, audience, module, installationId)
    }

    /**
     * The facts of a view that match a question, best first: the newest facts of the view AND the facts the word prefilter finds
     * anywhere in the view (`wordHits`), so a fact older than the window is still found by its words. Two reads, whatever the size.
     */
    async search(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const pool = await this.poolOf(workspaceId, audience, module, installationId, query, [])
        return searchFacts(pool, query, limit)
    }

    /**
     * The facts of a view that match a question by words and meaning (`hybridFacts`), best first: `near` are the facts a vector search
     * found for the question in the same lens (`BrainFactEmbeddingsService.nearest`); with none it is the word search. The candidates are
     * the newest 500 facts of the view, the word prefilter's hits (`wordHits`: every fact of the lens whose words match, read in SQL on
     * the folded-word index) and the vector hits, wherever they sit; every one is held to the same view rules (in force now, visible to
     * the lens, not shadowed) before it is ranked.
     */
    async searchHybrid(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        near: ReadonlyArray<RankedFact>,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const pool = await this.poolOf(
            workspaceId,
            audience,
            module,
            installationId,
            query,
            near.map((hit) => hit.fact).filter((fact) => fact.status === "active"),
        )
        return hybridFacts(pool, near, query, limit)
    }

    /**
     * The facts in force of a view whose folded words match any word of the question, best word match first, at most `WORD_HITS_MAX`:
     * ONE read on the folded-word index (migration 20261112015200), with the lens in SQL like the vector search, so a match older than
     * any window is found and the limit is never spent on facts the caller cannot see. Nothing for a question with no word.
     */
    async wordHits(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
    ): Promise<ReadonlyArray<FactRecord>> {
        const words = questionWordsOf(query)
        if (words.length === 0) return []
        const asked = "to_tsquery('simple'::regconfig, :words)"
        const read = this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(`f.workspaceId = :workspaceId AND ${FACT_WORDS_STATUSES_SQL} AND ${FACT_WORDS_SQL} @@ ${asked}`, {
                workspaceId,
                words: words.join(" | "),
            })
            .andWhere(
                installationId === null
                    ? "f.installationId IS NULL"
                    : "(f.installationId IS NULL OR f.installationId = :installationId)",
                { installationId },
            )
            .andWhere(
                audience === "customer"
                    ? "f.scope = 'public'"
                    : "(f.scope <> 'restricted' OR :module = ANY(f.modules))",
                { module },
            )
            .orderBy(`ts_rank(${FACT_WORDS_SQL}, ${asked})`, "DESC")
            .addOrderBy("f.updatedAt", "DESC")
            .limit(WORD_HITS_MAX)
        const rows = await read.getMany()
        return rows.map((row) => toFactRecord(row))
    }

    /**
     * The other values of the same truths as some served facts: every fact of those keys in force, scheduled or waiting (any scope:
     * the caller holds each to its own view), and the waiting proposals that name one of the served facts as possibly the same truth
     * (`conflictWith`). One bounded read: what a reader needs to know whether a truth is disputed or about to change.
     */
    async kinOf(workspaceId: string, kin: KinQuery): Promise<ReadonlyArray<FactRecord>> {
        if (kin.keys.length === 0 && kin.ids.length === 0) return []
        const parameters: Record<string, string | ReadonlyArray<string>> = { workspaceId }
        const keyed = kin.keys.map((key, index) => {
            parameters[`s${String(index)}`] = key.subjectKey
            parameters[`a${String(index)}`] = key.attribute
            return `(f.subjectKey = :s${String(index)} AND f.attribute = :a${String(index)})`
        })
        const named = kin.ids.length === 0 ? [] : ["(f.status = 'proposed' AND f.conflictWith IN (:...ids))"]
        if (kin.ids.length > 0) parameters.ids = [...kin.ids]
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(
                `f.workspaceId = :workspaceId AND f.status IN ('active', 'scheduled', 'proposed') AND (${[...keyed, ...named].join(" OR ")})`,
                parameters,
            )
            .orderBy("f.proposedAt", "DESC")
            .limit(KIN_MAX)
            .getMany()
        return rows.map((row) => toFactRecord(row))
    }

    /** The candidates of a search: the newest window of the view, the word hits and the given hits, each once, held to the view. */
    private async poolOf(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        hits: ReadonlyArray<FactRecord>,
    ): Promise<ReadonlyArray<FactRecord>> {
        const [window, words] = await Promise.all([
            this.list(workspaceId, { statuses: ["active", "scheduled"], limit: SEARCH_WINDOW }),
            this.wordHits(workspaceId, audience, module, installationId, query),
        ])
        const once = new Map([...window, ...words, ...hits].map((fact) => [fact.id, fact]))
        return this.inView([...once.values()], audience, module, installationId)
    }

    /** The facts of a set an agent reads now: active or scheduled, in force, inside its lens, and not shadowed (`unshadowed`). */
    private inView(
        facts: ReadonlyArray<FactRecord>,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
    ): ReadonlyArray<FactRecord> {
        const at = this.clock.now().getTime()
        const seen = facts.filter(
            (fact) =>
                (fact.status === "active" || fact.status === "scheduled") &&
                inForce(fact, at) &&
                visibleTo(fact, audience, module, installationId),
        )
        return unshadowed(seen, installationId)
    }

    /** The facts in these statuses whose evidence cites any of these documents, newest change first, in one bounded read. */
    async ofSources(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        statuses: ReadonlyArray<FactStatus>,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        if (sourceIds.length === 0 || statuses.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(
                "f.workspaceId = :workspaceId AND f.status IN (:...statuses) AND EXISTS (SELECT 1 FROM jsonb_array_elements(f.evidence) AS e WHERE e->>'kind' = 'document' AND e->>'ref' = ANY(:sourceIds))",
                { workspaceId, statuses: [...statuses], sourceIds: [...sourceIds] },
            )
            .orderBy("f.updatedAt", "DESC")
            .limit(Math.min(limit, LIST_MAX))
            .getMany()
        return rows.map((row) => toFactRecord(row))
    }

    /**
     * The workspaces whose upkeep is due now (BR1): a scheduled fact whose start has come, or a fact in force whose end has passed. The
     * timed brain upkeep (tick `brain-upkeep`, `BrainService.upkeep`) runs `maintain` for each; it is the one read across workspaces.
     * Each branch of the OR has its partial index (migration 20261112014800: `brain_facts_scheduled_start` on valid_from where scheduled,
     * `brain_facts_active_end` on valid_to where active), so a tick reads only the rows in those two states.
     */
    async dueWorkspaces(limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .select("f.workspaceId", "workspaceId")
            .distinct(true)
            .where("((f.status = 'scheduled' AND f.validFrom <= now()) OR (f.status = 'active' AND f.validTo < now()))")
            .limit(limit)
            .getRawMany<{ readonly workspaceId: string }>()
        return rows.map((row) => row.workspaceId)
    }

    /** The facts of the workspace with these ids (on the primary key), in no order; an id of another workspace is not answered. */
    async byIds(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FactRecord>> {
        const unique = [...new Set(ids)].slice(0, LIST_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => toFactRecord(row))
    }

    /**
     * The facts born from one passage (chunk) of a document, in these statuses: one read on the evidence index (`brain_facts_evidence`,
     * GIN jsonb_path_ops, which serves the containment below).
     */
    async bornFrom(
        workspaceId: string,
        sourceId: string,
        chunkHash: string,
        statuses: ReadonlyArray<FactStatus>,
    ): Promise<ReadonlyArray<FactRecord>> {
        if (statuses.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where("f.workspaceId = :workspaceId AND f.status IN (:...statuses) AND f.evidence @> :pattern::jsonb", {
                workspaceId,
                statuses: [...statuses],
                pattern: JSON.stringify([{ kind: "document", ref: sourceId, chunkHash }]),
            })
            .orderBy("f.updatedAt", "DESC")
            .limit(LIST_MAX)
            .getMany()
        return rows.map((row) => toFactRecord(row))
    }

    /**
     * What the workspace holds in force (active and scheduled truths, and the bytes of their text) as `em` sees it: inside a
     * transaction its own writes are counted. One aggregate on `brain_facts_ws_status`.
     */
    async heldInForce(em: EntityManager, workspaceId: string): Promise<InForceHeld> {
        const row = await em
            .createQueryBuilder(BrainFactEntity, "f")
            .select("COUNT(*)", "truths")
            .addSelect(IN_FORCE_BYTES, "bytes")
            .where({ workspaceId, status: In([...IN_FORCE_STATUSES]) })
            .getRawOne<InForceCount>()
        return { truths: Number(row?.truths ?? 0), bytes: Number(row?.bytes ?? 0) }
    }

    /** One fact through a manager. */
    async fetch(em: EntityManager, workspaceId: string, id: string): Promise<MaybeFact> {
        const row = await em.findOne(BrainFactEntity, { where: { workspaceId, id } })
        return row === null ? null : toFactRecord(row)
    }

    /** The facts of a key in one status and scope through a manager. */
    async keyed(
        em: EntityManager,
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        const rows = await em.find(BrainFactEntity, {
            where: { ...factKeyOf(workspaceId, subjectKey, attribute, installationId), status },
            order: { proposedAt: "DESC" },
            take: 50,
        })
        return rows.map((row) => toFactRecord(row))
    }
}
