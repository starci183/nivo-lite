import { builder } from "@starci/jest-preset"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"

const KnowledgeChunkEntity: (typeof knowledgeChunksEntities)[0] = knowledgeChunksEntities[0]
type KnowledgeChunkEntity = InstanceType<typeof KnowledgeChunkEntity>

/** A complete unembedded passage with deterministic source identity and no document place. */
export const knowledgeChunkOf: (overrides?: Partial<KnowledgeChunkEntity>) => KnowledgeChunkEntity = builder<
    InstanceType<typeof KnowledgeChunkEntity>
>({
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
    customerReady: true,
    embeddingModel: null,
    installationId: null,
    contentHash: null,
    placeKind: null,
    placeLabel: null,
    textHash: null,
    indexedAt: null,
    triage: null,
    triageVersion: null,
    truthsVersion: null,
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
})
