export { BRAIN_LESSONS_ERROR_KINDS } from "./errors/brain-lessons.error"
export { BrainLessonsModule } from "./brain-lessons.module"
export { BrainLessonsService } from "./brain-lessons.service"
export type { LessonEvidence, LessonRecord } from "./brain-lessons.contracts"
export { BRAIN_LESSONS_MESSAGES } from "./messages/brain-lessons.messages"
export { brainLessonsEntities } from "./persistence/entities"
export { LessonCandidatesService, factKeySlugOf } from "./lesson-candidates.service"
export { STOP_LEARNING_DEFAULTS } from "./lesson-candidates.contracts"
export type {
    LessonCandidate,
    LessonCandidateInput,
    LessonCandidateKept,
    LessonCandidateStatus,
    LessonCandidateThen,
    LessonFactKey,
    LessonPlace,
    StopLearningConfig,
} from "./lesson-candidates.contracts"
export {
    contradictionReasonOf,
    groupOf,
    learnedReasonOf,
    lessonWordsOf,
    maskedOf,
    namesCustomerData,
    sameAnswer,
    sameGap,
    withinWords,
} from "./lesson-candidates.policy"
