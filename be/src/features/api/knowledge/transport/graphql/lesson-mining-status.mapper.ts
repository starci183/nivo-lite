import type { LessonMiningStatusRequest } from "../../application/lesson-mining-status.contracts"
import type { LessonMiningState } from "@modules/domain/brain"
import type { LessonMiningStatusInput } from "./dto/lesson-mining-status.input"
import type { LessonMiningStatusType } from "./dto/lesson-mining-status.type"

/** Maps the GraphQL input to the request. */
export const toLessonMiningStatusRequest = (
    workspaceId: string,
    input: LessonMiningStatusInput,
): LessonMiningStatusRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the answer to the GraphQL type. */
export const toLessonMiningStatusType = (result: LessonMiningState): LessonMiningStatusType => ({ ...result })
