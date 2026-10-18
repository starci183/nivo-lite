import type { SalesAction, SalesItemRequest } from "@modules/domain/sales"
import type { Locale } from "@modules/platform/i18n"
import type { RetryFailedStepInput } from "./dto/retry-failed-step.input"
import type { SalesActionType } from "./dto/sales-action.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toRetryFailedStepRequest = (
    workspaceId: string,
    locale: Locale,
    input: RetryFailedStepInput,
): SalesItemRequest => ({
    workspaceId,
    locale,
    id: input.id,
})

/** Maps the domain result to the GraphQL contract. */
export const toRetryFailedStepType = (result: SalesAction): SalesActionType => ({
    id: result.id,
    status: result.status,
    workItemId: result.workItemId,
    errorCode: result.errorCode,
})
