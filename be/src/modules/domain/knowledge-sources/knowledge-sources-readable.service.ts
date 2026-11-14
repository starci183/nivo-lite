import { Injectable } from "@nestjs/common"
import { Brackets, In, type EntityManager, type SelectQueryBuilder } from "typeorm"
import { CUSTOMER_READY_COLUMN } from "@modules/domain/knowledge-chunks"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PASSAGE_JOIN, customerTextOf, type DocumentGate } from "./customer-text.policy"
import type { DocumentVisibility, ReadableScope, ReadableSource, ReadableSummary } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import type { ReadableSourceProjection } from "./persistence/knowledge-source.projection"

/** The trust gate of one document as the readable statement selects it (raw driver values). */
interface GateProjection {
    /** How many passages the document has stored. */
    readonly passages: number | string | null
    /** How many of them are served to customers. */
    readonly served: number | string | null
    /** The served passages in order, joined by `PASSAGE_JOIN`; null when none is served. */
    readonly servedText: string | null
}

/** The passages of the document row `ks`: the gate's sub-selects read only this document's rows (index `knowledge_chunks_source`). */
const OF_THIS_DOCUMENT = "FROM public.knowledge_chunks c WHERE c.source_id = ks.id AND c.workspace_id = ks.workspace_id"

/**
 * The documents that exist for a customer view (BR2): one with no stored passage (nothing the gate can hold) or with at least one served
 * passage. A document whose every passage is withheld has no text, no title and no count for a customer agent; the same rule as
 * `customerTextOf` answering null, applied in the statement so it also holds for the list and the count.
 */
const SERVED_TO_CUSTOMERS = `(NOT EXISTS (SELECT 1 ${OF_THIS_DOCUMENT}) OR EXISTS (SELECT 1 ${OF_THIS_DOCUMENT} AND c.${CUSTOMER_READY_COLUMN}))`

/** Adds the trust gate of each document to a readable statement (customer views only). */
const withCustomerGate = (query: SelectQueryBuilder<KnowledgeSourceEntity>): SelectQueryBuilder<KnowledgeSourceEntity> =>
    query
        .addSelect(`(SELECT count(*)::int ${OF_THIS_DOCUMENT})`, "passages")
        .addSelect(`(SELECT count(*)::int ${OF_THIS_DOCUMENT} AND c.${CUSTOMER_READY_COLUMN})`, "served")
        .addSelect(
            `(SELECT string_agg(c.content, :passageJoin ORDER BY c.ord) ${OF_THIS_DOCUMENT} AND c.${CUSTOMER_READY_COLUMN})`,
            "servedText",
        )
        .setParameter("passageJoin", PASSAGE_JOIN)

/** The gate of one selected row. */
const gateOf = (row: Partial<GateProjection>): DocumentGate => ({
    passages: Number(row.passages ?? 0),
    served: Number(row.served ?? 0),
    servedText: row.servedText ?? null,
})

@Injectable()
/** What an agent's view may read of the indexed documents of its workspace: the documents with their text, and how many there are. */
export class KnowledgeSourcesReadableService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The indexed documents an agent's view may read, oldest first; a customer view gets public documents only, and of each only what
     * the trust gate serves it (`customerTextOf`: the whole text when every passage is served, the served passages when some are held,
     * nothing when none is), so the whole-document door never hands a customer agent what the passage search withholds (BR1). The gate
     * is read in the same statement.
     */
    async readableFor(scope: ReadableScope, limit: number): Promise<ReadonlyArray<ReadableSource>> {
        const customer = scope.audience === "customer"
        const query = this.readable(scope)
            .select("ks.id", "id")
            .addSelect("ks.title", "title")
            .addSelect("ks.topic", "topic")
            .addSelect("ks.kind", "kind")
            .addSelect("ks.visibility", "visibility")
            .addSelect("ks.content", "content")
            .addSelect("ks.module", "module")
            .addSelect("ks.installationId", "installationId")
            .addSelect("ks.updated_at::text", "updatedAt")
        const rows = await (customer ? withCustomerGate(query) : query)
            .orderBy("ks.createdAt", "ASC")
            .limit(limit)
            .getRawMany<ReadableSourceProjection & Partial<GateProjection>>()
        return rows
            .filter(
                (row) =>
                    (row.module === null || row.module === scope.module) &&
                    (row.installationId === null || row.installationId === scope.installationId) &&
                    (scope.audience === "internal" || row.visibility === "public"),
            )
            .flatMap((row): ReadonlyArray<ReadableSource> => {
                const stored = row.content ?? ""
                const content = customer ? customerTextOf(stored, gateOf(row)) : stored
                if (content === null) return []
                return [
                    {
                        id: row.id,
                        title: row.title,
                        topic: row.topic,
                        kind: row.kind,
                        visibility: row.visibility === "public" ? "public" : "internal",
                        updatedAt: row.updatedAt,
                        content,
                    },
                ]
            })
    }

    /** The indexed documents the scope applies to, newest change first, without their text: what a list of the documents needs. */
    async summariesFor(scope: ReadableScope, limit: number): Promise<ReadonlyArray<ReadableSummary>> {
        const rows = await this.readable(scope)
            .select("ks.id", "id")
            .addSelect("ks.title", "title")
            .addSelect("ks.topic", "topic")
            .addSelect("ks.kind", "kind")
            .addSelect("ks.visibility", "visibility")
            .addSelect("ks.module", "module")
            .addSelect("ks.installationId", "installationId")
            .addSelect("ks.updated_at::text", "updatedAt")
            .orderBy("ks.updatedAt", "DESC")
            .limit(limit)
            .getRawMany<Omit<ReadableSourceProjection, "content">>()
        return rows
            .filter(
                (row) =>
                    (row.module === null || row.module === scope.module) &&
                    (row.installationId === null || row.installationId === scope.installationId),
            )
            .map((row) => ({
                id: row.id,
                title: row.title,
                topic: row.topic,
                kind: row.kind,
                visibility: row.visibility === "public" ? "public" : "internal",
                updatedAt: row.updatedAt,
            }))
    }

    /**
     * How many indexed documents of one visibility an agent's view may read; a customer view never counts internal ones, nor a public
     * document the trust gate withholds whole.
     */
    countReadable(scope: ReadableScope, visibility: DocumentVisibility): Promise<number> {
        if (scope.audience === "customer" && visibility === "internal") return Promise.resolve(0)
        return this.readable(scope).andWhere({ visibility }).getCount()
    }

    /**
     * The indexed documents of the workspace that the view of the scope may read: its module or every module, its instance or every
     * instance; a customer view only public documents that the trust gate does not withhold whole (`SERVED_TO_CUSTOMERS`).
     */
    private readable(scope: ReadableScope): SelectQueryBuilder<KnowledgeSourceEntity> {
        const query = this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .where({ workspaceId: scope.workspaceId, status: In(["ready", "extracting_facts"]) })
            .andWhere(
                new Brackets((own) =>
                    own.where("ks.module IS NULL").orWhere("ks.module = :module", { module: scope.module }),
                ),
            )
            .andWhere(
                new Brackets((own) =>
                    own
                        .where("ks.installationId IS NULL")
                        .orWhere("ks.installationId = :installationId", { installationId: scope.installationId }),
                ),
            )
        return scope.audience === "internal"
            ? query
            : query.andWhere({ visibility: "public" }).andWhere(SERVED_TO_CUSTOMERS)
    }
}
