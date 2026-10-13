import type {
    ExtendSubscriptionRequest,
    ExtendSubscriptionResult,
} from "../../application/extend-subscription.contracts"
import type { ExtendSubscriptionRequest as ExtendSubscriptionHttpRequest } from "./dto/extend-subscription.request"
import type { ExtendSubscriptionResponse } from "./dto/extend-subscription.response"

/** Maps the HTTP request to the application request. */
export const toExtendSubscriptionRequest = (
    workspaceId: string,
    input: ExtendSubscriptionHttpRequest,
): ExtendSubscriptionRequest => ({
    workspaceId,
    days: input.days,
})

/** Maps the application result to the HTTP response. */
export const toExtendSubscriptionResponse = (result: ExtendSubscriptionResult): ExtendSubscriptionResponse => result
