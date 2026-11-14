import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { firstPartIdOf, partPlaceOf, wholeTitleOf } from "./source-parts.policy"

/** The most documents one read cites: a search answers at most this many passages, each of one document. */
const CITES_MAX = 100

/** What a passage cites of its document. */
export interface SourceCite {
    /** The document (source) id. */
    readonly id: string
    /** The title, without the place of a part. */
    readonly title: string
    /** When the document last changed, ISO text: a passage says what the document said as of then. */
    readonly updatedAt: string
    /** How many passages the document holds. */
    readonly passages: number
    /** The place of this part in a long document, from 1, or null when the document is one part. */
    readonly part: number | null
    /** The first part's document id when this is a later part of a long document, else null. */
    readonly firstPartId: string | null
}

@Injectable()
/**
 * What a passage cites of the document it was cut from: title, last change, size. Read by primary key for the handful of documents a
 * search or a read names, in ONE statement; it checks no audience: the caller holds passages its lens already served, and cites only
 * their documents.
 */
export class KnowledgeSourceCitesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The cites of these documents of a workspace, by id; an id that is gone is left out. */
    async of(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, SourceCite>> {
        const ids = [...new Set(sourceIds)].slice(0, CITES_MAX)
        if (ids.length === 0) return new Map()
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, title: true, updatedAt: true, chunkCount: true, origin: true },
            where: { workspaceId, id: In(ids) },
            take: ids.length,
        })
        return new Map(
            rows.map((row) => [
                row.id,
                {
                    id: row.id,
                    title: wholeTitleOf(row.title),
                    updatedAt: row.updatedAt.toISOString(),
                    passages: row.chunkCount,
                    part: partPlaceOf(row.title),
                    firstPartId: firstPartIdOf(row.origin),
                },
            ]),
        )
    }
}
