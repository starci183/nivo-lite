import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { RequestContentMonthPlanRequest } from "../../application/request-content-month-plan.contracts"
import type { RequestContentMonthPlanInput } from "./dto/request-content-month-plan.input"
import type { ContentAiRequestedType } from "./dto/content-ai-requested.type"

/** Maps transport inputs and the selected workspace into an application request. */
export const toRequestContentMonthPlanRequest = (
    workspaceId: string,
    input: RequestContentMonthPlanInput,
): RequestContentMonthPlanRequest => ({ workspaceId, month: input.month })

/** A queued job with the item that the workbench may open immediately. */
export const toRequestContentMonthPlanType = (result: ContentAiRequested): ContentAiRequestedType => ({
    id: result.id,
    status: result.status,
    itemId: result.itemId,
})
