import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveAgentGraphLayoutMutation, SaveAgentGraphLayoutMutationVariables } from "../__generated__/graphql"

/** The input of the `saveAgentGraphLayout` mutation. */
export type MutateSaveAgentGraphLayoutRequest = WireInput<SaveAgentGraphLayoutMutationVariables["input"]>

type SaveAgentGraphLayoutMutationResponse = SaveAgentGraphLayoutMutation

const mutation1: TypedDocumentNode<SaveAgentGraphLayoutMutationResponse, InputVariables<MutateSaveAgentGraphLayoutRequest>> = gql`
    mutation SaveAgentGraphLayout($input: SaveAgentGraphLayoutInput!) {
        saveAgentGraphLayout(input: $input) { positions { workflowKey x y } }
    }
`

enum MutationSaveAgentGraphLayout {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveAgentGraphLayout, TypedDocumentNode<SaveAgentGraphLayoutMutationResponse, InputVariables<MutateSaveAgentGraphLayoutRequest>>> = {
    [MutationSaveAgentGraphLayout.Mutation1]: mutation1,
}

/** The back end `saveAgentGraphLayout` mutation. Replaces where each workflow sits on the Graph page. */
export const mutateSaveAgentGraphLayout = async ({
    mutation = MutationSaveAgentGraphLayout.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveAgentGraphLayout, MutateSaveAgentGraphLayoutRequest>): Promise<ApolloClient.MutateResult<SaveAgentGraphLayoutMutationResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
