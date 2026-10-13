import type { Query, QueryLoyaltyCampaignArgs } from "../../__generated__/schema"

/** The input of the `loyaltyCampaign` query. */
export type QueryLoyaltyCampaignRequest = QueryLoyaltyCampaignArgs["input"]

/** The response of the `loyaltyCampaign` query. */
export type QueryLoyaltyCampaignResponse = Pick<Query, "loyaltyCampaign">
