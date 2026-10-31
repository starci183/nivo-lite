import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetMcpToolGrantMutation, SetMcpToolGrantMutationVariables } from "../__generated__/graphql"

/** The input of the `setMcpToolGrant` mutation. */
type MutateSetMcpToolGrantRequest = WireInput<SetMcpToolGrantMutationVariables["input"]>

/** The response of the `setMcpToolGrant` mutation. */
type MutateSetMcpToolGrantResponse = SetMcpToolGrantMutation

const mutation1: TypedDocumentNode<MutateSetMcpToolGrantResponse, InputVariables<MutateSetMcpToolGrantRequest>> = gql`
    mutation SetMcpToolGrant($input: SetMcpToolGrantInput!) {
        setMcpToolGrant(input: $input)
    }
`

enum MutationSetMcpToolGrant {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetMcpToolGrant,
    TypedDocumentNode<MutateSetMcpToolGrantResponse, InputVariables<MutateSetMcpToolGrantRequest>>
> = {
    [MutationSetMcpToolGrant.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetMcpToolGrant}. */
type MutateSetMcpToolGrantParams = MutateParams<MutationSetMcpToolGrant, MutateSetMcpToolGrantRequest>

/** Turns one gateway tool on (`auto` or `ask`) or off (`never`) for one agent (owner or manager). */
export const mutateSetMcpToolGrant = async ({
    mutation = MutationSetMcpToolGrant.Mutation1,
    request,
    signal,
}: MutateSetMcpToolGrantParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
