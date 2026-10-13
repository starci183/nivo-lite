import type { DecideBrainLessonRequest } from "../../application/decide-brain-lesson.contracts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { DecideBrainLessonInput } from "./dto/decide-brain-lesson.input"
import type { BrainLessonType } from "./dto/brain-lesson.type"
import { toBrainLessonType } from "./brain-records.mapper"

/** Maps the GraphQL input to the request. */
export const toDecideBrainLessonRequest = (
    workspaceId: string,
    input: DecideBrainLessonInput,
): DecideBrainLessonRequest => ({
    workspaceId,
    id: input.id,
    action: input.action,
})

/** Maps the answer to the GraphQL type. */
export const toDecideBrainLessonType = (result: LessonRecord): BrainLessonType => toBrainLessonType(result)
