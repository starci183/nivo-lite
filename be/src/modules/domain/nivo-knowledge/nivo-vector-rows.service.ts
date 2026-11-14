import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import {
    PLATFORM_TENANT,
    type AcceptedRow,
    type VectorRow,
    type VectorRowCursor,
    type VectorRowSource,
    type WantedRow,
} from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { CORE_FOLDER } from "./nivo-item.policy"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** The most rows one read answers. */
const READ_MAX = 500

/** The longest text of an item that is embedded. */
export const EMBED_CHARS = 8000

/** The hash of each id, picked from the two arrays one write carries. */
const HASH_OF_ID =
    '(SELECT t.hash FROM unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[])) AS t(id, hash) WHERE t.id = "nivo_knowledge"."id")'

/** The text a vector of an item is made from: its title and body, cut at `EMBED_CHARS`. */
export const nivoEmbedTextOf = (item: { readonly title: string; readonly body: string }): string =>
    `${item.title}\n\n${item.body}`.slice(0, EMBED_CHARS)

/**
 * An item of the base knowledge as the vector sync reads it. No workspace owns it: its tenant is `PLATFORM_TENANT`. Every item wants a
 * point and is in force; every reader may read it (public and customer-ready); an item of the core folder is for every module (module
 * null), any other for its own module.
 */
const rowOf = (item: NivoKnowledgeItemEntity): VectorRow => {
    const text = nivoEmbedTextOf(item)
    const textHash = passageTextHashOf(text)
    return {
        id: item.id,
        workspaceId: PLATFORM_TENANT,
        wanted: true,
        text,
        textHash,
        mirror: {
            workspaceId: PLATFORM_TENANT,
            sourceId: null,
            module: item.module === CORE_FOLDER ? null : item.module,
            installationId: null,
            isPublic: true,
            customerReady: true,
            inForce: true,
        },
        stamped: item.indexedAt !== null && item.textHash === textHash,
        stampedModel: item.embeddingModel,
    }
}

@Injectable()
/**
 * The Postgres side of the base knowledge's points (kind `base`): the items the vector sync compares with the index, and the one write
 * it makes back (the identity, the hash of the text and `indexed_at`). One point per item row, the point id is the row id. A tenant
 * other than the platform's owns no item.
 */
export class NivoVectorRowsService implements VectorRowSource {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The items with these ids; nothing for a tenant other than the platform's. */
    async byIds(tenant: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (tenant !== PLATFORM_TENANT || unique.length === 0) return []
        const rows = await this.entityManager.find(NivoKnowledgeItemEntity, { where: { id: In(unique) }, take: unique.length })
        return rows.map((row) => rowOf(row))
    }

    /** Items belong to no document. */
    ofSource(): Promise<ReadonlyArray<VectorRow>> {
        return Promise.resolve([])
    }

    /** One page of every item, in id order after `afterId` (the primary key). */
    async page(afterId: VectorRowCursor, limit: number): Promise<ReadonlyArray<VectorRow>> {
        const query = this.entityManager.createQueryBuilder(NivoKnowledgeItemEntity, "k")
        if (afterId !== null) query.where("k.id > :afterId", { afterId })
        const rows = await query
            .orderBy("k.id", "ASC")
            .limit(Math.max(1, Math.min(limit, READ_MAX)))
            .getMany()
        return rows.map((row) => rowOf(row))
    }

    /** Among these ids, the items that exist (every item wants a point). */
    async wantedAmong(ids: ReadonlyArray<string>): Promise<ReadonlyArray<WantedRow>> {
        const unique = [...new Set(ids)].slice(0, READ_MAX)
        if (unique.length === 0) return []
        const rows = await this.entityManager.find(NivoKnowledgeItemEntity, {
            select: { id: true },
            where: { id: In(unique) },
            take: unique.length,
        })
        return rows.map((row) => ({ id: row.id, workspaceId: PLATFORM_TENANT }))
    }

    /** Items adopt nothing: an unchanged item keeps its row, and so its point, when the folder is published again. */
    donors(): Promise<ReadonlyMap<string, string>> {
        return Promise.resolve(new Map())
    }

    /** Records that the index accepted the vectors of these items under this identity: the identity, the hash of each text, `indexed_at`. */
    async stamp(tenant: string, accepted: ReadonlyArray<AcceptedRow>, model: string): Promise<void> {
        if (tenant !== PLATFORM_TENANT || accepted.length === 0) return
        await this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "k")
            .update()
            .set({ embeddingModel: model, textHash: () => HASH_OF_ID, indexedAt: () => "now()" })
            .where("id = ANY(CAST(:ids AS uuid[]))")
            .setParameters({ ids: accepted.map((row) => row.id), hashes: accepted.map((row) => row.textHash) })
            .execute()
    }
}
