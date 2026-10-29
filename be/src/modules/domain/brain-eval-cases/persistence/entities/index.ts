import { BrainEvalCaseEntity } from "./brain-eval-case.entity"

export { BrainEvalCaseEntity }

/** The entities the Brain eval cases capability owns, for the app's connection. */
export const brainEvalCasesEntities = [BrainEvalCaseEntity] as const
