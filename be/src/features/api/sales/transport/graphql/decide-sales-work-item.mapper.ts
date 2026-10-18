import type { SalesAction, SalesDecisionRequest } from "@modules/domain/sales"
import type { Locale } from "@modules/platform/i18n"
import type { DecideSalesWorkItemInput } from "./dto/decide-sales-work-item.input"
import type { SalesActionType } from "./dto/sales-action.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toDecideSalesWorkItemRequest = (
    workspaceId: string,
    locale: Locale,
    input: DecideSalesWorkItemInput,
): SalesDecisionRequest => ({
    workspaceId,
    locale,
    id: input.id,
    decision: input.decision,
    edits: input.edits,
    note: input.note,
    basis: input.basis,
})

/** Maps the domain result to the GraphQL contract. */
export const toDecideSalesWorkItemType = (result: SalesAction): SalesActionType => ({
    id: result.id,
    status: result.status,
    workItemId: result.workItemId,
    errorCode: result.errorCode,
})
