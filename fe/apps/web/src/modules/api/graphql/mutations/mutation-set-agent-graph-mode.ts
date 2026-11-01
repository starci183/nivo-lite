import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetAgentGraphModeMutation, SetAgentGraphModeMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentGraphMode` mutation. */
type MutateSetAgentGraphModeRequest = WireInput<SetAgentGraphModeMutationVariables["input"]>

/** The response of the `setAgentGraphMode` mutation: the typed payload straight from the back end contract. */
type MutateSetAgentGraphModeResponse = SetAgentGraphModeMutation

type Document = TypedDocumentNode<MutateSetAgentGraphModeResponse, InputVariables<MutateSetAgentGraphModeRequest>>

const mutation1: Document = gql`
    mutation SetAgentGraphMode($input: SetAgentGraphModeInput!) {
        setAgentGraphMode(input: $input)
    }
`

enum MutationSetAgentGraphMode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetAgentGraphMode, Document> = {
    [MutationSetAgentGraphMode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetAgentGraphMode}. */
type MutateSetAgentGraphModeParams = MutateParams<MutationSetAgentGraphMode, MutateSetAgentGraphModeRequest>

/** The back end `setAgentGraphMode` mutation. */
export const mutateSetAgentGraphMode = async ({
    mutation = MutationSetAgentGraphMode.Mutation1,
    request,
    signal,
}: MutateSetAgentGraphModeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
