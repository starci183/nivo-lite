import { builder } from "@starci/jest-preset"
import type { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { StoredNote, contentHashOf, knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"

const KnowledgeSourceEntity: (typeof knowledgeSourcesEntities)[0] = knowledgeSourcesEntities[0]
type KnowledgeSourceEntity = InstanceType<typeof KnowledgeSourceEntity>

/** Fixed document identity and time shared by the source row and its expected views. */
const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

/** A queued text document, with every persisted column. */
const sourceRowOf = builder<KnowledgeSourceEntity>({
    id: "s1",
    workspaceId: WS,
    module: null,
    installationId: null,
    kind: "text",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "T",
    content: "c",
    status: "queued",
    error: null,
    chunkCount: 0,
    progress: 0,
    stage: null,
    stageDone: null,
    stageTotal: null,
    contentHash: null,
    storagePath: null,
    sourceUrl: null,
    origin: null,
    sizeBytes: 0,
    createdBy: null,
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
})

/** The complete source row shared by source-owner unit proofs. */
export const row: KnowledgeSourceEntity = sourceRowOf()

type SourcePartRowsShape = {
    first: KnowledgeSourceEntity
    later: KnowledgeSourceEntity
    approved: KnowledgeSourceEntity
}

/** The first, later and approved document parts used by the part lifecycle proofs. */
export const SOURCE_PART_ROWS: SourcePartRowsShape = {
    first: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public" }),
    later: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public", id: "p2", title: "Plan (2/2)" }),
    approved: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public", origin: "public_document" }),
}
type SummaryShape = {
    id: string
    workspaceId: string
    module: null
    installationId: null
    kind: string
    topic: null
    tags: Array<never>
    visibility: string
    title: string
    status: string
    error: null
    chunkCount: number
    sizeBytes: number
    progress: number
    stage: null
    stageDone: null
    stageTotal: null
    createdAt: string
    updatedAt: string
    partCount: number
}

/** The independent expected list view. */
export const summary: SummaryShape = {
    id: "s1",
    workspaceId: WS,
    module: null,
    installationId: null,
    kind: "text",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "T",
    status: "queued",
    error: null,
    chunkCount: 0,
    sizeBytes: 0,
    progress: 0,
    stage: null,
    stageDone: null,
    stageTotal: null,
    createdAt: "2026-10-11T10:00:00.000Z",
    updatedAt: AT,
    partCount: 1,
}
type ReadableShape = {
    id: string
    title: string
    topic: null
    kind: string
    visibility: string
    updatedAt: string
    content: string
}

/** The independent expected readable view. */
export const readable: ReadableShape = {
    id: "shared",
    title: "T",
    topic: null,
    kind: "text",
    visibility: "public",
    updatedAt: AT,
    content: "c",
}

const ready = { status: "ready", progress: 100 }
const blocked = { status: "blocked_credits" }
const forIndex = StoredNote.NoCreditsForIndex
const forFacts = StoredNote.NoCreditsForFacts
const note = StoredNote.KeywordOnly
const contentHash = contentHashOf("text")

/** Test data for metadata changes. */
export const SOURCE_METADATA_CASES: ReadonlyArray<
    readonly [string, Parameters<KnowledgeSourcesService["updateSource"]>[2], object]
> = [
    [
        "changes the metadata of the source",
        { sourceId: "s1", title: "T", tags: ["a"], visibility: "internal" },
        { title: "T", tags: ["a"], visibility: "internal" },
    ],
    ["keeps the tags when none are given", { sourceId: "s1" }, {}],
]

/** Test data for typed lifecycle transitions. */
export const SOURCE_STAGE_CASES: Array<[string, (service: KnowledgeSourcesService) => Promise<void>, object]> = [
    ["fails", (s) => s.fail(WS, "s1", "CODE"), { status: "failed", error: "CODE" }],
    ["is ready", (s) => s.ready(WS, "s1", null), ready],
    ["is ready with the note of a failed reading", (s) => s.ready(WS, "s1", note), { ...ready, error: note }],
    ["settles with the hash of the text", (s) => s.settle(WS, "s1", "text"), { ...ready, contentHash }],
    ["keeps an unchanged source and its note", (s) => s.keepIndexed(WS, "s1", note), { ...ready, error: note }],
    [
        "blocks indexing",
        (s) => s.blockIndexing(WS, "s1", forIndex, 60),
        { ...blocked, error: forIndex, chunkCount: 60, progress: 80 },
    ],
    ["blocks the facts", (s) => s.blockFacts(WS, "s1", forFacts), { ...blocked, error: forFacts }],
]

/** Test data for explicit reindex requests. */
export const SOURCE_REINDEX_CASES: ReadonlyArray<
    readonly [string, Parameters<KnowledgeSourcesService["reindexSource"]>[2], object]
> = [
    ["replaces its text when new text is given", { sourceId: "s1", content: " new " }, { content: "new" }],
    ["keeps the text when none is given", { sourceId: "s1" }, {}],
]

/** Test data for origin lookup and reuse. */
export const SOURCE_ORIGIN_CASES: ReadonlyArray<readonly [string, KnowledgeSourceEntity | null, string, boolean]> = [
    ["answers the source an uploaded object already became instead of adding a second one", row, "s1", false],
    ["adds a new source for an uploaded object that no source holds yet", null, "s2", true],
]

type SourceWriteRowsResultUpdateShape = {
    readonly affected: number
}

type SourceWriteRowsResultShape = {
    update: readonly [typeof KnowledgeSourceEntity, SourceWriteRowsResultUpdateShape]
}

/** The exact source write result arranged for the spec's own typed manager. */
export const sourceWriteRows = (affected = 1): SourceWriteRowsResultShape => ({
    update: [KnowledgeSourceEntity, { affected }] as const,
})

type SourceUnchangedRowsResultShape = {
    findOne: readonly [typeof KnowledgeSourceEntity, KnowledgeSourceEntity | null]
    update: readonly [typeof KnowledgeSourceEntity, SourceWriteRowsResultUpdateShape]
}

/** A refused source write followed by its scoped ownership lookup. */
export const sourceUnchangedRows = (existing: KnowledgeSourceEntity | null): SourceUnchangedRowsResultShape => ({
    ...sourceWriteRows(0),
    findOne: [KnowledgeSourceEntity, existing] as const,
})

type SourceOriginRowsResultInsertIdentifiersShape = {
    id: string
}

type SourceOriginRowsResultInsertShape = {
    readonly identifiers: Array<SourceOriginRowsResultInsertIdentifiersShape>
}

type SourceOriginRowsResultShape = {
    findOne: readonly [typeof KnowledgeSourceEntity, KnowledgeSourceEntity | null]
    insert: readonly [typeof KnowledgeSourceEntity, SourceOriginRowsResultInsertShape]
}

/** Data arranged for origin lookup followed by the optional source insert. */
export const sourceOriginRows = (found: KnowledgeSourceEntity | null, id: string): SourceOriginRowsResultShape => ({
    ...sourceInsertRows(id),
    findOne: [KnowledgeSourceEntity, found] as const,
})

type SourceInsertRowsResultInsertShape = {
    readonly identifiers: Array<SourceOriginRowsResultInsertIdentifiersShape>
}

type SourceInsertRowsResultShape = {
    insert: readonly [typeof KnowledgeSourceEntity, SourceInsertRowsResultInsertShape]
}

/** Data arranged for a source insert with the given generated identifier. */
export const sourceInsertRows = (id = "s1"): SourceInsertRowsResultShape => {
    const identifiers = [{ id }]
    return { insert: [KnowledgeSourceEntity, { identifiers }] as const }
}
