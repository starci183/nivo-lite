import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLoyaltyCampaign } from "@/modules/api/graphql/queries"
import type { QueryLoyaltyCampaignRequest } from "@/modules/api/graphql/queries/types/loyalty-campaign"

/** The SWR key of the `loyaltyCampaign` query; mutations that change it match it with {@link isQueryLoyaltyCampaignSwrKey}. */
export const QUERY_LOYALTY_CAMPAIGN_SWR_KEY = "QUERY_LOYALTY_CAMPAIGN_SWR"

/** Matches every key of `loyaltyCampaign` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryLoyaltyCampaignSwrKey = (key: unknown): boolean =>
    key === QUERY_LOYALTY_CAMPAIGN_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_LOYALTY_CAMPAIGN_SWR_KEY)

/** One loyalty campaign, polled while the back end drafts its message (status leaves waiting when done). */
export const useQueryLoyaltyCampaignSwr = (request: QueryLoyaltyCampaignRequest | null, config?: SWRConfiguration) =>
    useSWR(request === null ? null : [QUERY_LOYALTY_CAMPAIGN_SWR_KEY, request], async (key: readonly [string, QueryLoyaltyCampaignRequest]) => {
        const result = await queryLoyaltyCampaign({ request: key[1] })
        if (!result.data) throw new Error("loyaltyCampaign answered no data")
        return result.data.loyaltyCampaign
    }, config)
