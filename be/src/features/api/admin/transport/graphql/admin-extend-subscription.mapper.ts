import type {
    ExtendSubscriptionRequest,
    ExtendSubscriptionResult,
} from "../../application/extend-subscription.contracts"
import type { AdminExtendSubscriptionInput } from "./dto/admin-extend-subscription.input"
import type { AdminSubscriptionExtendedType } from "./dto/admin-subscription-extended.type"

/** Maps the GraphQL input to the application request. */
export const toAdminExtendSubscriptionRequest = (input: AdminExtendSubscriptionInput): ExtendSubscriptionRequest => ({
    workspaceId: input.workspaceId,
    days: input.days,
})

/** Maps the application result to the GraphQL type. */
export const toAdminSubscriptionExtendedType = (result: ExtendSubscriptionResult): AdminSubscriptionExtendedType => ({
    paidUntil: result.paidUntil,
})
