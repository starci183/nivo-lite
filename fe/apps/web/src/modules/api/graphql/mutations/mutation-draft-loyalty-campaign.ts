import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateDraftLoyaltyCampaignRequest, MutateDraftLoyaltyCampaignResponse } from "./types/draft-loyalty-campaign"

const mutation1 = gql`
    mutation DraftLoyaltyCampaign($input: DraftCampaignInput!) {
        draftLoyaltyCampaign(input: $input) {
            campaignId draft id recipients status
        }
    }
`

export enum MutationDraftLoyaltyCampaign {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDraftLoyaltyCampaign, DocumentNode> = {
    [MutationDraftLoyaltyCampaign.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDraftLoyaltyCampaign}. */
export type MutationDraftLoyaltyCampaignParams = MutateParams<MutationDraftLoyaltyCampaign, MutateDraftLoyaltyCampaignRequest>

/** Enqueues the drafting of one campaign message; poll loyaltyCampaign until status leaves waiting. */
export const mutateDraftLoyaltyCampaign = async ({ mutation = MutationDraftLoyaltyCampaign.Mutation1, request, signal }: MutationDraftLoyaltyCampaignParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateDraftLoyaltyCampaignResponse, InputVariables<MutateDraftLoyaltyCampaignRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
