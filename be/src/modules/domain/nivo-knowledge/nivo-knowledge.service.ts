import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    NivoEntry,
    NivoItemInput,
    NivoRule,
    NivoUnembedded,
    NivoVectorWrite,
    NivoWriteResult,
} from "./nivo-knowledge.contracts"
import { CORE_FOLDER } from "./nivo-item.policy"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** The most items the Knowledge page lists. */
const LIST_LIMIT = 500

/** The condition under which an item keeps its vector: its title and body did not change. */
const UNCHANGED = '"nivo_knowledge"."body" = EXCLUDED."body" AND "nivo_knowledge"."title" = EXCLUDED."title"'

/**
 * The conflict clause that publishes an item by its slug: an unchanged text keeps its version and vector, a changed one takes
 * the next version and loses its vector.
 */
const UPSERT_CONFLICT = `("slug") DO UPDATE SET
    "module" = EXCLUDED."module", "title" = EXCLUDED."title", "body" = EXCLUDED."body", "kind" = EXCLUDED."kind",
    "version" = CASE WHEN ${UNCHANGED} THEN "nivo_knowledge"."version" ELSE "nivo_knowledge"."version" + 1 END,
    "embedding" = CASE WHEN ${UNCHANGED} THEN "nivo_knowledge"."embedding" ELSE NULL END,
    "embedding_model" = CASE WHEN ${UNCHANGED} THEN "nivo_knowledge"."embedding_model" ELSE NULL END,
    "updated_at" = now()`

/** The vector of each id, picked from the two arrays the write carries. */
const VECTOR_OF_ID =
    '(SELECT t.embedding::extensions.vector FROM unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[])) AS t(id, embedding) WHERE t.id = "nivo_knowledge"."id")'

/** The longest text of an item that is embedded. */
const EMBED_CHARS = 8000

@Injectable()
/** The base knowledge of NIVO: its items are written from the resource files and given vectors. */
export class NivoKnowledgeService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Inserts the new items and updates the changed ones in one transaction; an item whose text changed loses its vector, an unchanged
     * one keeps it.
     */
    upsert(items: ReadonlyArray<NivoItemInput>): Promise<NivoWriteResult> {
        return this.entityManager.transaction(async (tx) => {
            const counts = { inserted: 0, updated: 0 }
            await eachInOrder(items, async (item) => {
                const result = await tx
                    .createQueryBuilder(NivoKnowledgeItemEntity, "nivo_knowledge")
                    .insert()
                    .values({
                        module: item.module,
                        slug: item.slug,
                        title: item.title,
                        body: item.body,
                        kind: item.kind,
                    })
                    .onConflict(UPSERT_CONFLICT)
                    .returning("(xmax = 0) AS inserted")
                    .execute()
                const [row] = result.raw as Array<{ inserted: boolean }>
                if (row?.inserted === true) counts.inserted += 1
                else counts.updated += 1
            })
            return counts
        })
    }

    /**
     * How many base-knowledge items belong to the module, counting the shared core with it.
     * A request for the core itself is not counted twice. Any signed-in person may read it.
     */
    countForModule(module: string): Promise<number> {
        return this.countFor(module === CORE_FOLDER ? [CORE_FOLDER] : [module, CORE_FOLDER])
    }

    /** How many base-knowledge items belong to the named modules. */
    async countFor(modules: ReadonlyArray<string>): Promise<number> {
        return this.entityManager.count(NivoKnowledgeItemEntity, { where: { module: In([...modules]) } })
    }

    /** The title and text of the items of the named modules and kinds, the later module name first, then by slug, at most `limit`. */
    async rulesOf(
        modules: ReadonlyArray<string>,
        kinds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<NivoRule>> {
        const rows = await this.entityManager.find(NivoKnowledgeItemEntity, {
            select: { title: true, body: true },
            where: { module: In([...modules]), kind: In([...kinds]) },
            order: { module: "DESC", slug: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ title: row.title, body: row.body }))
    }

    /** Every item of the base knowledge, for the Knowledge page; any signed-in person may read it. */
    async list(): Promise<ReadonlyArray<NivoEntry>> {
        const rows = await this.entityManager.find(NivoKnowledgeItemEntity, {
            order: { module: "ASC", kind: "ASC", slug: "ASC" },
            take: LIST_LIMIT,
        })
        return rows.map((row) => ({
            id: row.id,
            module: row.module,
            slug: row.slug,
            title: row.title,
            body: row.body,
            kind: row.kind,
            version: row.version,
            updatedAt: row.updatedAt.toISOString(),
        }))
    }

    /** Removes the items whose slug is not given, so the table mirrors the folder; answers how many went. */
    async removeExcept(slugs: ReadonlyArray<string>): Promise<number> {
        const removed = await this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "n")
            .delete()
            .where("slug <> ALL(CAST(:slugs AS text[]))", { slugs: [...slugs] })
            .returning("id")
            .execute()
        return (removed.raw as Array<{ id: string }>).length
    }

    /** Up to `limit` items without a vector of `model`, with the text to embed. */
    async unembedded(model: string, limit: number): Promise<ReadonlyArray<NivoUnembedded>> {
        const rows = await this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "k")
            .select(["k.id", "k.title", "k.body"])
            .where("k.embedding IS NULL OR k.embeddingModel IS NULL OR k.embeddingModel <> :model", { model })
            .orderBy("k.module", "ASC")
            .addOrderBy("k.slug", "ASC")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({ id: row.id, text: `${row.title}\n\n${row.body}`.slice(0, EMBED_CHARS) }))
    }

    /** Gives items their vectors. */
    async setVectors(write: NivoVectorWrite): Promise<void> {
        await this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "n")
            .update()
            .set({ embedding: () => VECTOR_OF_ID, embeddingModel: write.model })
            .where("id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({ ids: [...write.ids], vectors: [...write.vectors] })
            .execute()
    }
}
