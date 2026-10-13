import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    NivoEntry,
    NivoItemInput,
    NivoUnembedded,
    NivoVectorWrite,
    NivoWriteResult,
} from "./nivo-knowledge.contracts"
import { CORE_FOLDER } from "./nivo-item.policy"
import type {
    NivoEntryRow,
    RemovedNivoRow,
    UnembeddedNivoRow,
    UpsertedNivoRow,
} from "./persistence/nivo-knowledge.rows"
import {
    COUNT_NIVO_FOR_MODULES,
    DELETE_STALE_NIVO_ITEMS,
    LIST_NIVO_ITEMS,
    SELECT_NIVO_UNEMBEDDED,
    UPDATE_NIVO_VECTORS,
    UPSERT_NIVO_ITEM,
} from "./persistence/nivo-knowledge.sql"

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
                const [row] = await tx.query<Array<UpsertedNivoRow>>(UPSERT_NIVO_ITEM, [
                    item.module,
                    item.slug,
                    item.title,
                    item.body,
                    item.kind,
                ])
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
        const [row] = await this.entityManager.query<Array<{ count: number }>>(COUNT_NIVO_FOR_MODULES, [[...modules]])
        return row?.count ?? 0
    }

    /** Every item of the base knowledge, for the Knowledge page; any signed-in person may read it. */
    async list(): Promise<ReadonlyArray<NivoEntry>> {
        const rows = await this.entityManager.query<Array<NivoEntryRow>>(LIST_NIVO_ITEMS)
        return rows.map((row) => ({
            id: row.id,
            module: row.module,
            slug: row.slug,
            title: row.title,
            body: row.body,
            kind: row.kind,
            version: row.version,
            updatedAt: new Date(row.updated_at).toISOString(),
        }))
    }

    /** Removes the items whose slug is not given, so the table mirrors the folder; answers how many went. */
    async removeExcept(slugs: ReadonlyArray<string>): Promise<number> {
        const removed = await this.entityManager.query<Array<RemovedNivoRow>>(DELETE_STALE_NIVO_ITEMS, [slugs])
        return removed.length
    }

    /** Up to `limit` items without a vector of `model`, with the text to embed. */
    async unembedded(model: string, limit: number): Promise<ReadonlyArray<NivoUnembedded>> {
        const rows = await this.entityManager.query<Array<UnembeddedNivoRow>>(SELECT_NIVO_UNEMBEDDED, [model, limit])
        return rows.map((row) => ({ id: row.id, text: `${row.title}\n\n${row.body}`.slice(0, EMBED_CHARS) }))
    }

    /** Gives items their vectors. */
    async setVectors(write: NivoVectorWrite): Promise<void> {
        await this.entityManager.query(UPDATE_NIVO_VECTORS, [write.ids, write.vectors, write.model])
    }
}
