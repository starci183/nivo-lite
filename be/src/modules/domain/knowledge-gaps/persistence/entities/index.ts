import { KnowledgeGapEntity } from "./knowledge-gap.entity"

export { KnowledgeGapEntity }
export type { KnowledgeGapStatus } from "./knowledge-gap.entity"

/** The entities the knowledge-gaps capability owns, collected by the database module. */
export const knowledgeGapsEntities = [KnowledgeGapEntity] as const
