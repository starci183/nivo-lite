"use client"

import useSWRMutation from "swr/mutation"
import { mutateDraftLoyaltyCampaign } from "@/modules/api/graphql/mutations/mutation-draft-loyalty-campaign"
import type { MutateDraftLoyaltyCampaignRequest } from "@/modules/api/graphql/mutations/types/draft-loyalty-campaign"

/** The SWR key of the `draftLoyaltyCampaign` mutation. */
export const MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR_KEY = "MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateDraftLoyaltyCampaignRequest
}

/** Enqueues the drafting of one campaign message; poll loyaltyCampaign until status leaves waiting. */
export const useMutateDraftLoyaltyCampaignSwr = () =>
    useSWRMutation(MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateDraftLoyaltyCampaign({ request: arg })
        if (!result.data) throw new Error("draftLoyaltyCampaign answered no data")
        return result.data.draftLoyaltyCampaign
    })
