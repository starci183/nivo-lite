import { builder } from "@starci/jest-preset"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"

const [KnowledgeChunkEntity] = knowledgeChunksEntities

/** A complete unembedded passage with deterministic source identity and no document place. */
export const knowledgeChunkOf = builder<InstanceType<typeof KnowledgeChunkEntity>>({
    id: "c1",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    sourceId: "s1",
    module: "chatbot",
    ord: 0,
    content: "a",
    embedding: null,
    fts: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    visibility: "internal",
    embeddingModel: null,
    installationId: null,
    contentHash: null,
    placeKind: null,
    placeLabel: null,
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
})
