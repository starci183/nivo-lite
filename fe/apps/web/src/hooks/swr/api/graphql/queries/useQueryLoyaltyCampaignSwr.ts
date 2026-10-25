"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryLoyaltyCampaign } from "@/modules/api/graphql/queries/query-loyalty-campaign"
import type { QueryLoyaltyCampaignRequest } from "@/modules/api/graphql/queries/types/loyalty-campaign"

/** The SWR key of the `loyaltyCampaign` query. */
export const QUERY_LOYALTY_CAMPAIGN_SWR_KEY = "QUERY_LOYALTY_CAMPAIGN_SWR"

/** One loyalty campaign, polled while the back end drafts its message (status leaves waiting when done). */
export const useQueryLoyaltyCampaignSwr = (request: QueryLoyaltyCampaignRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_LOYALTY_CAMPAIGN_SWR_KEY, request === null ? null : [request]),
        async (key: WorkspaceReadKey<QueryLoyaltyCampaignRequest>) => {
            const result = await queryLoyaltyCampaign({ request: key[2] })
            if (!result.data) throw new Error("loyaltyCampaign answered no data")
            return result.data.loyaltyCampaign
        },
        config,
    )
