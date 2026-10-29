import { BrainLessonEntity } from "./brain-lesson.entity"

export { BrainLessonEntity }

/** The entities the Brain lessons capability owns, for the app's connection. */
export const brainLessonsEntities = [BrainLessonEntity] as const
