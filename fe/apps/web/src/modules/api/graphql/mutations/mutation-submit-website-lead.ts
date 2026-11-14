import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SubmitWebsiteLeadMutation, SubmitWebsiteLeadMutationVariables } from "../__generated__/graphql"

/** Generated input of the SubmitWebsiteLead mutation. */
type MutateSubmitWebsiteLeadRequest = WireInput<SubmitWebsiteLeadMutationVariables["input"]>

type MutateSubmitWebsiteLeadResponse = SubmitWebsiteLeadMutation

type Document = TypedDocumentNode<MutateSubmitWebsiteLeadResponse, InputVariables<MutateSubmitWebsiteLeadRequest>>

const mutation1: Document = gql`
    mutation SubmitWebsiteLead($input: SubmitWebsiteLeadInput!) {
        submitWebsiteLead(input: $input)
    }
`

enum MutationSubmitWebsiteLead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSubmitWebsiteLead, Document> = { [MutationSubmitWebsiteLead.Mutation1]: mutation1 }

/** Parameters of the SubmitWebsiteLead mutation. */
type MutateSubmitWebsiteLeadParams = MutateParams<MutationSubmitWebsiteLead, MutateSubmitWebsiteLeadRequest>

/** Sends the form of an anonymous visitor of the hosted page of a shop website, under the public key of the page. */
export const mutateSubmitWebsiteLead = async ({
    mutation = MutationSubmitWebsiteLead.Mutation1,
    request,
    signal,
}: MutateSubmitWebsiteLeadParams): Promise<ApolloClient.MutateResult<MutateSubmitWebsiteLeadResponse>> => {
    const apollo = createNoAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
