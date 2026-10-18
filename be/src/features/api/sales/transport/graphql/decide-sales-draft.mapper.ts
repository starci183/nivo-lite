import type { SalesAction, SalesDraftRequest } from "@modules/domain/sales"
import type { Locale } from "@modules/platform/i18n"
import type { DecideSalesDraftInput } from "./dto/decide-sales-draft.input"
import type { SalesActionType } from "./dto/sales-action.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toDecideSalesDraftRequest = (
    workspaceId: string,
    locale: Locale,
    input: DecideSalesDraftInput,
): SalesDraftRequest => ({
    workspaceId,
    locale,
    id: input.id,
    decision: input.decision,
    editedDraft: input.editedDraft,
})

/** Maps the domain result to the GraphQL contract. */
export const toDecideSalesDraftType = (result: SalesAction): SalesActionType => ({
    id: result.id,
    status: result.status,
    workItemId: result.workItemId,
    errorCode: result.errorCode,
})
