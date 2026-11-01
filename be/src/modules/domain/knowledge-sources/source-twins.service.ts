import { Injectable } from "@nestjs/common"
import { IsNull, Like, MoreThan, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SourceRecord } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import type { KnowledgeSourceStatus } from "./persistence/entities"
import { contentHashOf } from "./source-hash.policy"
import { firstPartIdOf, partOriginOf, partTextsInOrder } from "./source-parts.policy"

/** A document the workspace already holds, as the owner is told about it. */
export interface SourceTwin {
    /** The id of the document that already holds this text. */
    readonly id: string
    /** Its title. */
    readonly title: string
}

/** The most finished documents compared with a new one, oldest first: the same text is rarely in more than a few. */
const CANDIDATES_MAX = 20

/** The most later parts a document has. */
const PARTS_MAX = 500

/** The document that repeats a text, or null when none does. */
export type MaybeTwin = SourceTwin | null

/** The text of a document as the indexing reads it: the first part, and the later parts of a document longer than a source may be. */
export interface TextParts {
    /** The part that stays in the source. */
    readonly first: string
    /** The parts that would become sources of their own. */
    readonly later: ReadonlyArray<string>
}

@Injectable()
/** Finds the document a new source repeats, so the same text is never cut, embedded, read for facts and reviewed twice in a workspace. */
export class SourceTwinsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The finished document of the workspace that holds exactly this text for the same readers (module, agent instance and audience), or
     * null. Only a source that never finished is compared: a document being read again keeps its own work. A document cut into parts
     * is a twin only when every part is the same. The twin's passages and facts are complete (its hash is only set then).
     */
    async twinOf(source: SourceRecord, text: TextParts): Promise<MaybeTwin> {
        const own = await this.entityManager.findOne(KnowledgeSourceEntity, {
            select: { chunkCount: true, origin: true },
            where: { workspaceId: source.workspaceId, id: source.id },
        })
        if (own === null || own.chunkCount > 0 || firstPartIdOf(own.origin) !== null) return null
        const finished: KnowledgeSourceStatus = "ready"
        const audience: "public" | "internal" = source.visibility === "public" ? "public" : "internal"
        const same = {
            workspaceId: source.workspaceId,
            contentHash: contentHashOf(text.first),
            status: finished,
            chunkCount: MoreThan(0),
            module: source.module ?? IsNull(),
            installationId: source.installationId ?? IsNull(),
            visibility: audience,
            id: Not(source.id),
        }
        const candidates = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, title: true, origin: true },
            where: [
                { ...same, origin: IsNull() },
                { ...same, origin: Not(Like(`${partOriginOf("")}%`)) },
            ],
            order: { createdAt: "ASC" },
            take: CANDIDATES_MAX,
        })
        const twin = await this.firstHolding(source.workspaceId, candidates, text.later)
        return twin === null ? null : { id: twin.id, title: twin.title }
    }

    /** The first of the candidates whose later parts are these texts, asking one at a time and stopping at the first that does. */
    private async firstHolding(
        workspaceId: string,
        candidates: ReadonlyArray<KnowledgeSourceEntity>,
        later: ReadonlyArray<string>,
    ): Promise<KnowledgeSourceEntity | null> {
        const [head, ...rest] = candidates
        if (head === undefined) return null
        return (await this.holdsLater(workspaceId, head.id, later)) ? head : this.firstHolding(workspaceId, rest, later)
    }

    /** Whether the later parts of a document are these texts, part by part. */
    private async holdsLater(workspaceId: string, firstId: string, later: ReadonlyArray<string>): Promise<boolean> {
        const stored = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { title: true, content: true },
            where: { workspaceId, origin: partOriginOf(firstId) },
            take: PARTS_MAX,
        })
        const texts = partTextsInOrder(stored)
        return texts.length === later.length && texts.every((one, index) => one === later[index])
    }
}
