import { builder } from "@starci/jest-preset"
import { passageHashOf, type EmbeddedChunk } from "@modules/domain/knowledge-chunks"
import { StoredNote, type SourceRecord } from "@modules/domain/knowledge-sources"

/** The workspace of the indexing specs. */
export const INDEXING_WS = "11111111-1111-4111-8111-111111111111"

/** A long text of many paragraphs, past one batch of passages. */
export const MANY: string = Array.from({ length: 70 }, (_, i) => `Paragraph ${i} ${"y".repeat(700)}`).join("\n\n")

/** A table that has a separator but no row. */
export const TABLE_WITHOUT_ROWS = "|---|---|\n|---|---|\n|---|---|"

/** A stored passage from before hashes, of the model in use unless named. */
export const legacy = (text: string, order: number, model = "m1"): EmbeddedChunk => ({
    id: `c${order}`,
    order,
    text,
    hash: null,
    model,
})

/** A stored passage with its hash. */
export const stored = (text: string, order: number): EmbeddedChunk => ({
    ...legacy(text, order),
    hash: passageHashOf(text, "m1"),
})

/** A queued note of the indexing specs. */
export const sourceOf: (overrides?: Partial<SourceRecord>) => SourceRecord = builder<SourceRecord>({
    id: "s1",
    workspaceId: INDEXING_WS,
    module: "chatbot",
    installationId: null,
    kind: "text",
    topic: null,
    visibility: "internal",
    title: "Hours",
    content: "Open 8 to 21",
    status: "queued",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    contentHash: null,
    updatedAt: "2026-10-12T10:00:00.000Z",
})

/** Stored passage variants, in their original table order. */
export const INDEXING_STALE_PASSAGES: Array<[string, Array<EmbeddedChunk>]> = [
    ["another text", [legacy("Other", 0)]],
    ["another model", [legacy("Open 8 to 21", 0, "m0")]],
    ["another order", [legacy("Open 8 to 21", 1)]],
    ["another count", []],
]

/** Unindexable text answers and their exact stored note codes. */
export const INDEXING_EMPTY_TEXTS: Array<[string, string, string]> = [
    ["no text", "   ", StoredNote.Empty],
    ["text that makes no passage", TABLE_WITHOUT_ROWS, StoredNote.NoPassages],
]

/** Whole-source kinds and the same number of allowed reader calls. */
export const INDEXING_WHOLE_SOURCE_KINDS: Array<[SourceRecord["kind"], number]> = [
    ["file", 0],
    ["url", 1],
]

type IndexingTextWriteDraftsShape = {
    text: string
    vector: string
    order: number
}

type IndexingTextWriteShape = {
    workspaceId: string
    sourceId: string
    module: string
    visibility: string
    installationId: null
    model: string
    drafts: Array<IndexingTextWriteDraftsShape>
}

/** The exact persisted passage write expected for the default text source. */
export const INDEXING_TEXT_WRITE: IndexingTextWriteShape = {
    workspaceId: INDEXING_WS,
    sourceId: "s1",
    module: "chatbot",
    visibility: "internal",
    installationId: null,
    model: "m1",
    drafts: [{ text: "Open 8 to 21", vector: "[0.5,1]", order: 0 }],
}

/** The exact embed progress snapshot of the default text source. */
export const INDEXING_EMBED_STAGE = {
    stage: "embed",
    done: 0,
    total: 1,
    progress: 25,
}

/** The exact store progress snapshot of the default text source. */
export const INDEXING_STORE_STAGE = {
    stage: "store",
    done: 1,
    total: 1,
    progress: 80,
}
