import { Injectable } from "@nestjs/common"
import { BrainExtractionsService, type DocumentTruthsView, type MaybeDocumentTruths } from "@modules/domain/brain-extractions"
import { KnowledgeSourcesReadService, firstPartIdOf, partOriginOf } from "@modules/domain/knowledge-sources"
import { rolledUpTruthsOf } from "./document-truths-rollup.policy"

/** The most parts one document has (a file of 50 MB cut at 120,000 characters is fewer). */
const PARTS_MAX = 500

/** The most sources one read of the extractions answers. */
const READ_MAX = 500

/** A listed document: its first part, and how many parts it has. */
export interface ListedDocument {
    /** The source the list shows (the first part). */
    readonly id: string
    /** How many parts the document has; 1 for a document that fits one source. */
    readonly partCount: number
}

@Injectable()
/**
 * A document longer than one source is several sources (parts). The truths work runs AND settles per part (no part waits for
 * another); this service reads it per DOCUMENT: the ids of every part (a part's settle reads the others' waiting truths for what
 * contradicts it), and the truths state of the whole document for the documents page.
 */
export class DocumentPartsService {
    constructor(
        private readonly reads: KnowledgeSourcesReadService,
        private readonly extractions: BrainExtractionsService,
    ) {}

    /** The ids of every part of the document this source belongs to, the first part first; the source alone when it has no parts. */
    async wholeOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<string>> {
        const firstId = firstPartIdOf(await this.reads.originOf(workspaceId, sourceId)) ?? sourceId
        const later = await this.reads.ofOrigin(workspaceId, partOriginOf(firstId), PARTS_MAX)
        return [firstId, ...later.map((part) => part.id).filter((id) => id !== firstId)]
    }

    /**
     * Where the truths of these listed documents stand, by listed id: a document of several parts is rolled up (`rolledUpTruthsOf`:
     * counts summed, state of the least advanced part). A document with no truths work yet is absent.
     */
    async truthsOf(workspaceId: string, listed: ReadonlyArray<ListedDocument>): Promise<ReadonlyMap<string, DocumentTruthsView>> {
        const whole = await Promise.all(
            listed.map(async (one) => ({
                id: one.id,
                parts: one.partCount > 1 ? await this.wholeOf(workspaceId, one.id) : [one.id],
            })),
        )
        const truths = await this.truthsOfAll(
            workspaceId,
            whole.flatMap((one) => one.parts),
        )
        const rolled = whole.map((one): readonly [string, MaybeDocumentTruths] => [
            one.id,
            rolledUpTruthsOf(one.parts.map((id) => truths.get(id) ?? null)),
        ])
        return new Map(rolled.flatMap(([id, state]): Array<[string, DocumentTruthsView]> => (state === null ? [] : [[id, state]])))
    }

    /** The truths states of these sources, read `READ_MAX` at a time (the bound of one read of the extractions). */
    private async truthsOfAll(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, DocumentTruthsView>> {
        const batches = Array.from({ length: Math.ceil(ids.length / READ_MAX) }, (_, index) =>
            ids.slice(index * READ_MAX, index * READ_MAX + READ_MAX),
        )
        const read = await Promise.all(batches.map((batch) => this.extractions.truthsOf(workspaceId, batch)))
        return new Map(read.flatMap((one) => [...one.entries()]))
    }
}
