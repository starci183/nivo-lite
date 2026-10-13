import type { ContentAiStatus } from "@modules/domain/content-ai"
import type { GetContentAiStatusRequest } from "../../application/get-content-ai-status.contracts"
import type { GetContentAiStatusInput } from "./dto/get-content-ai-status.input"
import type { ContentAiStatusType } from "./dto/content-ai-status.type"

/** Binds the polling id to the selected workspace. */
export const toGetContentAiStatusRequest = (
    workspaceId: string,
    input: GetContentAiStatusInput,
): GetContentAiStatusRequest => ({ workspaceId, id: input.id })

/** Maps the durable result and each review finding to the contract. */
export const toGetContentAiStatusType = (result: ContentAiStatus): ContentAiStatusType => ({
    id: result.id,
    status: result.status,
    progress: result.progress,
    itemId: result.itemId,
    planId: result.planId,
    resultId: result.resultId,
    ideas: result.ideas,
    seconds: result.seconds,
    skippedPast: result.skippedPast,
    errorCode: result.errorCode,
    warnings: result.warnings.map(({ channel, warning }) => ({
        channel,
        warning: {
            kind: warning.kind,
            phrase: warning.phrase,
            figure: warning.figure,
            length: warning.length,
            max: warning.max,
        },
    })),
})
