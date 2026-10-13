import type { PromoState } from "@modules/domain/promo"
import type { PromoStateRequest } from "../../application/promo-state.contracts"
import type { PromoStateType } from "./dto/promo-state.type"

/** Maps the workspace selector to the application request. */
export const toPromoStateRequest = (workspaceId: string): PromoStateRequest => ({ workspaceId })

/** Maps the service result to its GraphQL output. */
export const toPromoStateType = (result: PromoState): PromoStateType => ({
    ...result,
    websiteLeadStats: { ...result.websiteLeadStats },
    onboarding: result.onboarding.map((step) => ({ ...step })),
})
