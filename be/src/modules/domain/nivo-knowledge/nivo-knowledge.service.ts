import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { PLATFORM_TENANT } from "@modules/integrations/qdrant"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { VECTOR_SYNC_IDS_MAX, VectorSyncQueue } from "@modules/queues/vector-sync"
import type { NivoEntry, NivoItemInput, NivoRemoveResult, NivoRule, NivoWriteResult } from "./nivo-knowledge.contracts"
import { CORE_FOLDER } from "./nivo-item.policy"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** The most items the Knowledge page lists. */
const LIST_LIMIT = 500

/** The row an insert or a delete returns for each item it touched. */
const isTouchedRow = rowShape({ id: "string" })

@Injectable()
/**
 * The base knowledge of NIVO: its items are written from the resource files. An item is a row kind that declares it is embedded (kind
 * `base`, tenant `PLATFORM_TENANT`): every write commits its `vector.sync` job in the same transaction, and the job brings the index
 * in step (embeds a changed text, drops the point of a removed item). Postgres holds no vector.
 */
export class NivoKnowledgeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly vectorSync: VectorSyncQueue,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Inserts the new items and updates the existing ones in one transaction, with the `vector.sync` job of every item written: the
     * job re-reads them and embeds only those whose text changed (an unchanged item keeps its point).
     */
    upsert(items: ReadonlyArray<NivoItemInput>): Promise<NivoWriteResult> {
        return this.entityManager.transaction(async (tx) => {
            const counts = { inserted: 0, updated: 0 }
            const written = new Array<string>()
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
                    .orIgnore()
                    .returning("id")
                    .execute()
                const inserted = returnedRows(result.raw, isTouchedRow)
                if (inserted.length > 0) {
                    counts.inserted += 1
                    written.push(...inserted.map((row) => row.id))
                    return
                }
                counts.updated += 1
                const id = await this.republish(tx, item)
                if (id !== null) written.push(id)
            })
            await this.changed(tx, written)
            return { ...counts, queued: written.length }
        })
    }

    /** Republishes an item that exists: an unchanged text keeps its version, a changed one takes the next; answers its id. */
    private async republish(tx: EntityManager, item: NivoItemInput): Promise<string | null> {
        const current = await tx.findOne(NivoKnowledgeItemEntity, {
            select: { id: true, title: true, body: true },
            where: { slug: item.slug },
        })
        if (current === null) return null
        const fields = { module: item.module, title: item.title, body: item.body, kind: item.kind }
        const changed = current.title !== item.title || current.body !== item.body
        await tx.update(
            NivoKnowledgeItemEntity,
            { id: current.id },
            changed ? { ...fields, version: () => '"version" + 1' } : fields,
        )
        return current.id
    }

    /** The `vector.sync` jobs of these items, in the caller's transaction, at most `VECTOR_SYNC_IDS_MAX` ids each. */
    private async changed(tx: EntityManager, ids: ReadonlyArray<string>): Promise<void> {
        const at = this.clock.now().getTime()
        const starts = Array.from({ length: Math.ceil(ids.length / VECTOR_SYNC_IDS_MAX) }, (_, index) => index * VECTOR_SYNC_IDS_MAX)
        await eachInOrder(starts, (from) =>
            this.vectorSync.enqueueSync(
                { kind: "base", workspaceId: PLATFORM_TENANT, ids: ids.slice(from, from + VECTOR_SYNC_IDS_MAX), at },
                tx,
            ),
        )
    }

    /**
     * How many base-knowledge items belong to the module, counting the shared core with it.
     * A request for the core itself is not counted twice. Any signed-in person may read it.
     */
    countForModule(module: string): Promise<number> {
        return this.countFor(module === CORE_FOLDER ? [CORE_FOLDER] : [module, CORE_FOLDER])
    }

    /** How many base-knowledge items belong to the named modules. */
    countFor(modules: ReadonlyArray<string>): Promise<number> {
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

    /**
     * Removes the items whose slug is not given, so the table mirrors the folder, with the `vector.sync` job of every removed item in
     * the same transaction (its point goes).
     */
    removeExcept(slugs: ReadonlyArray<string>): Promise<NivoRemoveResult> {
        return this.entityManager.transaction(async (tx) => {
            const removed = await tx
                .createQueryBuilder(NivoKnowledgeItemEntity, "n")
                .delete()
                .where("slug <> ALL(CAST(:slugs AS text[]))", { slugs: [...slugs] })
                .returning("id")
                .execute()
            const ids = returnedRows(removed.raw, isTouchedRow).map((row) => row.id)
            await this.changed(tx, ids)
            return { removed: ids.length, queued: ids.length }
        })
    }
}
