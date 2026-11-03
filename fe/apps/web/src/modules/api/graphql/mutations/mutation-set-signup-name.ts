import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetSignupNameMutation, SetSignupNameMutationVariables } from "../__generated__/graphql"

/** The input of the `setSignupName` mutation. */
type MutateSetSignupNameRequest = WireInput<SetSignupNameMutationVariables["input"]>

/** The response of the `setSignupName` mutation: the typed payload straight from the back end contract. */
type MutateSetSignupNameResponse = SetSignupNameMutation

type Document = TypedDocumentNode<MutateSetSignupNameResponse, InputVariables<MutateSetSignupNameRequest>>

const mutation1: Document = gql`
    mutation SetSignupName($input: SetSignupNameInput!) {
        setSignupName(input: $input)
    }
`

enum MutationSetSignupName {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetSignupName, Document> = {
    [MutationSetSignupName.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetSignupName}. */
type MutateSetSignupNameParams = MutateParams<MutationSetSignupName, MutateSetSignupNameRequest>

/** Keeps the full name typed at sign-up on the new account (the back end `setSignupName` mutation, public). */
export const mutateSetSignupName = async ({
    mutation = MutationSetSignupName.Mutation1,
    request,
    signal,
}: MutateSetSignupNameParams): Promise<ApolloClient.MutateResult<MutateSetSignupNameResponse>> => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
