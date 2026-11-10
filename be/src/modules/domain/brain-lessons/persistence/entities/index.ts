import { BrainLessonCandidateEntity } from "./brain-lesson-candidate.entity"
import { BrainLessonEntity } from "./brain-lesson.entity"

export { BrainLessonCandidateEntity, BrainLessonEntity }
export type { LessonCandidateStatus, LessonCandidateThen } from "./brain-lesson-candidate.entity"

/** The entities the Brain lessons capability owns, for the app's connection. */
export const brainLessonsEntities: readonly [typeof BrainLessonEntity, typeof BrainLessonCandidateEntity] = [
    BrainLessonEntity,
    BrainLessonCandidateEntity,
] as const
