import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { LinkContactIdentityMutation, LinkContactIdentityMutationVariables } from "../__generated__/graphql"

/** The input of the `linkContactIdentity` mutation. */
type MutateLinkContactIdentityRequest = WireInput<LinkContactIdentityMutationVariables["input"]>

/** The response of the `linkContactIdentity` mutation: the typed payload straight from the back end contract. */
type MutateLinkContactIdentityResponse = LinkContactIdentityMutation

type Document = TypedDocumentNode<MutateLinkContactIdentityResponse, InputVariables<MutateLinkContactIdentityRequest>>

const mutation1: Document = gql`
    mutation LinkContactIdentity($input: LinkContactIdentityInput!) {
        linkContactIdentity(input: $input) {
            outcome
            contactId
        }
    }
`

enum MutationLinkContactIdentity {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationLinkContactIdentity, Document> = {
    [MutationLinkContactIdentity.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateLinkContactIdentity}. */
type MutateLinkContactIdentityParams = MutateParams<MutationLinkContactIdentity, MutateLinkContactIdentityRequest>

/** Links one more way to reach a person (the back end `linkContactIdentity` mutation): the outcome says whether it joined, waits for proof or was refused. */
export const mutateLinkContactIdentity = async ({
    mutation = MutationLinkContactIdentity.Mutation1,
    request,
    signal,
}: MutateLinkContactIdentityParams): Promise<ApolloClient.MutateResult<MutateLinkContactIdentityResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
