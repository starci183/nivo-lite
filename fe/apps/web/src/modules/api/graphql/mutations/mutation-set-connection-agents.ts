import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetConnectionAgentsArgs } from "../__generated__/schema"

/** The input of the `setConnectionAgents` mutation. */
export type MutateSetConnectionAgentsRequest = MutationSetConnectionAgentsArgs["input"]

/** The response of the `setConnectionAgents` mutation. */
type MutateSetConnectionAgentsResponse = Pick<Mutation, "setConnectionAgents">

const mutation1: TypedDocumentNode<
    MutateSetConnectionAgentsResponse,
    InputVariables<MutateSetConnectionAgentsRequest>
> = gql`
    mutation SetConnectionAgents($input: SetConnectionAgentsInput!) {
        setConnectionAgents(input: $input)
    }
`

enum MutationSetConnectionAgents {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetConnectionAgents,
    TypedDocumentNode<MutateSetConnectionAgentsResponse, InputVariables<MutateSetConnectionAgentsRequest>>
> = {
    [MutationSetConnectionAgents.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetConnectionAgents}. */
type MutateSetConnectionAgentsParams = MutateParams<MutationSetConnectionAgents, MutateSetConnectionAgentsRequest>

/** Sets exactly which agents work through a connection. */
export const mutateSetConnectionAgents = async ({
    mutation = MutationSetConnectionAgents.Mutation1,
    request,
    signal,
}: MutateSetConnectionAgentsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
