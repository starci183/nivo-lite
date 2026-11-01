import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"

const [KnowledgeSourceEntity] = knowledgeSourcesEntities
type KnowledgeSourceEntity = InstanceType<typeof KnowledgeSourceEntity>

/** Fixed document identity and time shared by the source row and its expected views. */
const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

/** A queued text document, with every persisted column. */
export const row: KnowledgeSourceEntity = {
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
