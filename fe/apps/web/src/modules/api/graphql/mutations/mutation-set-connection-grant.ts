import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetConnectionGrantMutation, SetConnectionGrantMutationVariables } from "../__generated__/graphql"

/** The input of the `setConnectionGrant` mutation. */
type MutateSetConnectionGrantRequest = WireInput<SetConnectionGrantMutationVariables["input"]>

/** The response of the `setConnectionGrant` mutation. */
type MutateSetConnectionGrantResponse = SetConnectionGrantMutation

const mutation1: TypedDocumentNode<
    MutateSetConnectionGrantResponse,
    InputVariables<MutateSetConnectionGrantRequest>
> = gql`
    mutation SetConnectionGrant($input: SetConnectionGrantInput!) {
        setConnectionGrant(input: $input)
    }
`

enum MutationSetConnectionGrant {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetConnectionGrant,
    TypedDocumentNode<MutateSetConnectionGrantResponse, InputVariables<MutateSetConnectionGrantRequest>>
> = {
    [MutationSetConnectionGrant.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetConnectionGrant}. */
type MutateSetConnectionGrantParams = MutateParams<MutationSetConnectionGrant, MutateSetConnectionGrantRequest>

/** Gives one agent a level through a connection, or removes it. */
export const mutateSetConnectionGrant = async ({
    mutation = MutationSetConnectionGrant.Mutation1,
    request,
    signal,
}: MutateSetConnectionGrantParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
