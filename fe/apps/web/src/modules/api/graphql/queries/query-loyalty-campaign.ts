import type { LoyaltyCampaignQuery } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryLoyaltyCampaignRequest } from "./types/loyalty-campaign"

const query1 = gql`
    query LoyaltyCampaign($input: LoyaltyCampaignInput!) {
        loyaltyCampaign(input: $input) {
            createdAt
            createdBy
            draft
            draftMs
            errorCode
            failed
            finishedAt
            id
            messageDraft
            name
            queued
            recipients
            segment {
                birthdayThisMonth
                inactiveDays
                minSpendVnd
                tiers
            }
            sent
            skipped
            status
            workItemId
        }
    }
`

enum QueryLoyaltyCampaign {
    Query1 = "query1",
}

const queryMap: Record<QueryLoyaltyCampaign, DocumentNode> = {
    [QueryLoyaltyCampaign.Query1]: query1,
}

/** Apollo params for {@link queryLoyaltyCampaign}. */
type QueryLoyaltyCampaignParams = QueryParams<QueryLoyaltyCampaign, QueryLoyaltyCampaignRequest> & {
    request: QueryLoyaltyCampaignRequest
}

/** One loyalty campaign, polled while the back end drafts its message (status leaves waiting when done). */
export const queryLoyaltyCampaign = async ({
    query = QueryLoyaltyCampaign.Query1,
    request,
    signal,
}: QueryLoyaltyCampaignParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<LoyaltyCampaignQuery, InputVariables<QueryLoyaltyCampaignRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
