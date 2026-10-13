import useSWRMutation from "swr/mutation"
import { mutateDraftLoyaltyCampaign } from "@/modules/api/graphql/mutations"
import type { MutateDraftLoyaltyCampaignRequest } from "@/modules/api/graphql/mutations/types/draft-loyalty-campaign"

/** The SWR key of the `draftLoyaltyCampaign` mutation. */
export const MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR_KEY = "MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR"

/** Enqueues the drafting of one campaign message; poll loyaltyCampaign until status leaves waiting. */
export const useMutateDraftLoyaltyCampaignSwr = () =>
    useSWRMutation(
        MUTATE_DRAFT_LOYALTY_CAMPAIGN_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateDraftLoyaltyCampaignRequest }) => {
            const result = await mutateDraftLoyaltyCampaign({ request: arg })
            if (!result.data) throw new Error("draftLoyaltyCampaign answered no data")
            return result.data.draftLoyaltyCampaign
        },
    )
