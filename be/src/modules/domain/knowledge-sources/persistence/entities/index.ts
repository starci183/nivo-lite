import { KnowledgeSourceEntity } from "./knowledge-source.entity"

export { KnowledgeSourceEntity }
export type { KnowledgeSourceStatus } from "./knowledge-source.entity"

/** The entities the knowledge sources capability owns, for the app's connection. */
export const knowledgeSourcesEntities = [KnowledgeSourceEntity] as const
