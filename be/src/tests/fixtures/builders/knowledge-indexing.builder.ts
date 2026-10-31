import { builder } from "@starci/jest-preset"
import { passageHashOf } from "@modules/domain/knowledge-chunks"
import type { EmbeddedChunk } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"

/** The workspace of the indexing specs. */
export const INDEXING_WS = "11111111-1111-4111-8111-111111111111"

/** A long text of many paragraphs, past one batch of passages. */
export const MANY = Array.from({ length: 70 }, (_, i) => `Paragraph ${i} ${"y".repeat(700)}`).join("\n\n")

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
export const sourceOf = builder<SourceRecord>({
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
