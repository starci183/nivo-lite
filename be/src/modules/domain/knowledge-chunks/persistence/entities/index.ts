import { KnowledgeChunkEntity } from "./knowledge-chunk.entity"

export { KnowledgeChunkEntity }

/** Every entity the knowledge-chunks capability owns, collected by the database connection. */
export const knowledgeChunksEntities: readonly [typeof KnowledgeChunkEntity] = [KnowledgeChunkEntity] as const
