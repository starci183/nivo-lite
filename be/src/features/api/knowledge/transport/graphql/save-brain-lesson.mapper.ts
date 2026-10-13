import type { SaveBrainLessonRequest } from "../../application/save-brain-lesson.contracts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { SaveBrainLessonInput } from "./dto/save-brain-lesson.input"
import type { BrainLessonType } from "./dto/brain-lesson.type"
import { toBrainLessonType } from "./brain-records.mapper"

/** Maps the GraphQL input to the request. */
export const toSaveBrainLessonRequest = (workspaceId: string, input: SaveBrainLessonInput): SaveBrainLessonRequest => ({
    workspaceId,
    module: input.module,
    title: input.title,
    body: input.body,
    appliesWhen: input.appliesWhen,
})

/** Maps the answer to the GraphQL type. */
export const toSaveBrainLessonType = (result: LessonRecord): BrainLessonType => toBrainLessonType(result)
