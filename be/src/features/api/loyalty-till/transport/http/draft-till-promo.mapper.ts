import type { DraftTillPromoRequest, DraftTillPromoResult } from "../../application/draft-till-promo.contracts"
import type { DraftTillPromoBodyRequest } from "./dto/draft-till-promo.request"
import type { DraftTillPromoResponse } from "./dto/draft-till-promo.response"

/** Maps the HTTP input of draft-till-promo to the command request. */
export const toDraftTillPromoRequest = (
    body: DraftTillPromoBodyRequest,
    authorization: string,
): DraftTillPromoRequest => ({
    name: body.name,
    brief: body.brief,
    segment: {
        tiers: [...body.segment.tiers],
        inactiveDays: body.segment.inactive_days,
        birthdayThisMonth: body.segment.birthday_this_month,
        minSpendVnd: body.segment.min_spend_vnd,
    },
    authorization: authorization,
})

/** Maps the draft-till-promo result to the HTTP answer. */
export const toDraftTillPromoResponse = (result: DraftTillPromoResult): DraftTillPromoResponse => ({
    campaign_id: result.campaignId,
    status: result.status,
    recipients: result.recipients,
    draft: result.draft,
})
