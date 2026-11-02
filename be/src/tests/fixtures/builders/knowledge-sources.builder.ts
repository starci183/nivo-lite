import { builder } from "@starci/jest-preset"
import type { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { StoredNote, contentHashOf, knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"

const [KnowledgeSourceEntity] = knowledgeSourcesEntities
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
export const row = sourceRowOf()

/** The first, later and approved document parts used by the part lifecycle proofs. */
export const SOURCE_PART_ROWS = {
    first: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public" }),
    later: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public", id: "p2", title: "Plan (2/2)" }),
    approved: sourceRowOf({ topic: "Legal", tags: ["a"], visibility: "public", origin: "public_document" }),
}
/** The independent expected list view. */
export const summary = {
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
/** The independent expected readable view. */
export const readable = {
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

/** The exact source write result arranged for the spec's own typed manager. */
export const sourceWriteRows = (affected = 1) => ({ update: [KnowledgeSourceEntity, { affected }] as const })

/** A refused source write followed by its scoped ownership lookup. */
export const sourceUnchangedRows = (existing: KnowledgeSourceEntity | null) => ({
    ...sourceWriteRows(0),
    findOne: [KnowledgeSourceEntity, existing] as const,
})

/** Data arranged for origin lookup followed by the optional source insert. */
export const sourceOriginRows = (found: KnowledgeSourceEntity | null, id: string) => ({
    ...sourceInsertRows(id),
    findOne: [KnowledgeSourceEntity, found] as const,
})

/** Data arranged for a source insert with the given generated identifier. */
export const sourceInsertRows = (id = "s1") => {
    const identifiers = [{ id }]
    return { insert: [KnowledgeSourceEntity, { identifiers }] as const }
}
