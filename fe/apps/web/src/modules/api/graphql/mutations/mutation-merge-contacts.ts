import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { MergeContactsMutation, MergeContactsMutationVariables } from "../__generated__/graphql"

/** The input of the `mergeContacts` mutation. */
type MutateMergeContactsRequest = WireInput<MergeContactsMutationVariables["input"]>

/** The response of the `mergeContacts` mutation: the typed payload straight from the back end contract. */
type MutateMergeContactsResponse = MergeContactsMutation

type Document = TypedDocumentNode<MutateMergeContactsResponse, InputVariables<MutateMergeContactsRequest>>

const mutation1: Document = gql`
    mutation MergeContacts($input: MergeContactsInput!) {
        mergeContacts(input: $input) {
            id
            displayName
            tags
            createdAt
            updatedAt
            identities {
                id
                kind
                provider
                account
                value
                verified
                verifiedBy
                source
                joinedBy
                at
            }
        }
    }
`

enum MutationMergeContacts {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMergeContacts, Document> = {
    [MutationMergeContacts.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateMergeContacts}. */
type MutateMergeContactsParams = MutateParams<MutationMergeContacts, MutateMergeContactsRequest>

/** Merges two people into the older one (the back end `mergeContacts` mutation); the answer is the surviving person. */
export const mutateMergeContacts = async ({
    mutation = MutationMergeContacts.Mutation1,
    request,
    signal,
}: MutateMergeContactsParams): Promise<ApolloClient.MutateResult<MutateMergeContactsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
