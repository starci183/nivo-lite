import type { RequestLessonMiningRequest } from "../../application/request-lesson-mining.contracts"
import type { RequestLessonMiningInput } from "./dto/request-lesson-mining.input"
import type { BrainCommandRefType } from "./dto/brain-command-ref.type"

/** Maps the GraphQL input to the request. */
export const toRequestLessonMiningRequest = (
    workspaceId: string,
    input: RequestLessonMiningInput,
): RequestLessonMiningRequest => ({
    workspaceId,
    module: input.module,
})

/** Maps the answer to the GraphQL type. */
export const toRequestLessonMiningType = (result: string): BrainCommandRefType => ({ id: result })
