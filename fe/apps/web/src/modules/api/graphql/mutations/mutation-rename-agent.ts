import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RenameAgentMutation, RenameAgentMutationVariables } from "../__generated__/graphql"

/** The input of the `renameAgent` mutation. */
export type MutateRenameAgentRequest = WireInput<RenameAgentMutationVariables["input"]>

type MutateRenameAgentResponse = RenameAgentMutation

const mutation1: TypedDocumentNode<MutateRenameAgentResponse, InputVariables<MutateRenameAgentRequest>> = gql`
    mutation RenameAgent($input: RenameAgentInput!) {
        renameAgent(input: $input) {
            ok
        }
    }
`

enum MutationRenameAgent {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRenameAgent,
    TypedDocumentNode<MutateRenameAgentResponse, InputVariables<MutateRenameAgentRequest>>
> = {
    [MutationRenameAgent.Mutation1]: mutation1,
}

/** The back end `renameAgent` mutation: the display name of one agent (the @handle never changes). */
export const mutateRenameAgent = async ({
    mutation = MutationRenameAgent.Mutation1,
    request,
    signal,
}: MutateParams<MutationRenameAgent, MutateRenameAgentRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
