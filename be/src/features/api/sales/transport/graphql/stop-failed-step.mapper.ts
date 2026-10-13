import type { WorkItem } from "@modules/domain/decisions"
import type { Locale } from "@modules/platform/i18n"
import type { SalesItemRequest } from "@modules/domain/sales"
import type { StopFailedStepInput } from "./dto/stop-failed-step.input"
import type { StopFailedStepType } from "./dto/stop-failed-step.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toStopFailedStepRequest = (
    workspaceId: string,
    locale: Locale,
    input: StopFailedStepInput,
): SalesItemRequest => ({
    workspaceId,
    locale,
    id: input.id,
})

/** Maps the domain result to the GraphQL contract. */
export const toStopFailedStepType = (result: WorkItem): StopFailedStepType => ({
    id: result.id,
    status: result.status,
})
