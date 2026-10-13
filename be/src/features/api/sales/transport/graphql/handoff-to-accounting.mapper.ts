import type { SalesAction } from "@modules/domain/sales"
import type { Locale } from "@modules/platform/i18n"
import type { SalesItemRequest } from "@modules/domain/sales"
import type { HandoffToAccountingInput } from "./dto/handoff-to-accounting.input"
import type { SalesActionType } from "./dto/sales-action.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toHandoffToAccountingRequest = (
    workspaceId: string,
    locale: Locale,
    input: HandoffToAccountingInput,
): SalesItemRequest => ({
    workspaceId,
    locale,
    id: input.id,
})

/** Maps the domain result to the GraphQL contract. */
export const toHandoffToAccountingType = (result: SalesAction): SalesActionType => ({
    id: result.id,
    status: result.status,
    workItemId: result.workItemId,
    errorCode: result.errorCode,
})
