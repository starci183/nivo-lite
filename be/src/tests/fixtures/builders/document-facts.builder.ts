import { builder } from "@starci/jest-preset"
import type { SourceRecord } from "@modules/domain/knowledge-sources"

/** The workspace of the document facts specs. */
export const DOC_WS = "11111111-1111-4111-8111-111111111111"
/** The document of the document facts specs. */
export const DOC_SOURCE = "22222222-2222-4222-8222-222222222222"
/** The time the document was last updated. */
export const DOC_AT = "2026-10-12T10:00:00.000Z"
/** The text of the document. */
export const DOC_CONTENT = "Hours 8am-9pm. Price 20 USD."

/** The document a fact extraction reads: a public note that waits for its facts. */
export const docSourceOf = builder<SourceRecord>({
    id: DOC_SOURCE,
    workspaceId: DOC_WS,
    module: "chatbot",
    installationId: "i1",
    kind: "text",
    topic: "Open",
    visibility: "public",
    title: "Hours",
    content: DOC_CONTENT,
    status: "extracting_facts",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    contentHash: null,
    updatedAt: DOC_AT,
})
