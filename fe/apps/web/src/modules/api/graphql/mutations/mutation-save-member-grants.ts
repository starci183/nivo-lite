import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveMemberGrantsMutation, SaveMemberGrantsMutationVariables } from "../__generated__/graphql"

/** The input of the `saveMemberGrants` mutation. */
export type MutateSaveMemberGrantsRequest = WireInput<SaveMemberGrantsMutationVariables["input"]>

type MutateSaveMemberGrantsResponse = SaveMemberGrantsMutation

const mutation1: TypedDocumentNode<MutateSaveMemberGrantsResponse, InputVariables<MutateSaveMemberGrantsRequest>> = gql`
    mutation SaveMemberGrants($input: SaveMemberGrantsInput!) {
        saveMemberGrants(input: $input) {
            action
            maxAmount
            memberId
            unit
        }
    }
`

enum MutationSaveMemberGrants {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveMemberGrants,
    TypedDocumentNode<MutateSaveMemberGrantsResponse, InputVariables<MutateSaveMemberGrantsRequest>>
> = {
    [MutationSaveMemberGrants.Mutation1]: mutation1,
}

/** The back end `saveMemberGrants` mutation. */
export const mutateSaveMemberGrants = async ({
    mutation = MutationSaveMemberGrants.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveMemberGrants, MutateSaveMemberGrantsRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
