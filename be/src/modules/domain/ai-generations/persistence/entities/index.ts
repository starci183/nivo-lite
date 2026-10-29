import { AiGenerationEntity } from "./ai-generation.entity"

export { AiGenerationEntity }
export type { AiGenerationStatus } from "./ai-generation.entity"

/** The entities the ai-generations capability owns, for the app's connection. */
export const aiGenerationsEntities = [AiGenerationEntity] as const
