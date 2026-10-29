import { NivoKnowledgeItemEntity } from "./nivo-knowledge-item.entity"

export { NivoKnowledgeItemEntity }

/** Every entity the nivo-knowledge capability owns, collected by the database connection. */
export const nivoKnowledgeEntities = [NivoKnowledgeItemEntity] as const
