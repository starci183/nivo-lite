import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { BrainLessonType } from "./dto/brain-lesson.type"
import { toLessonEvidenceType } from "./brain-evidence.mapper"

/** Maps a lesson to the GraphQL type. */
export const toBrainLessonType = (lesson: LessonRecord): BrainLessonType => ({
    id: lesson.id,
    module: lesson.module,
    title: lesson.title,
    body: lesson.body,
    appliesWhen: lesson.appliesWhen,
    status: lesson.status,
    evidence: lesson.evidence.map((item) => toLessonEvidenceType(item)),
})
