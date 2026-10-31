import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveAgentGraphDraftMutation, SaveAgentGraphDraftMutationVariables } from "../__generated__/graphql"

/** The input of the `saveAgentGraphDraft` mutation. */
type MutateSaveAgentGraphDraftRequest = WireInput<SaveAgentGraphDraftMutationVariables["input"]>

/** The response of the `saveAgentGraphDraft` mutation: the typed payload straight from the back end contract. */
type MutateSaveAgentGraphDraftResponse = SaveAgentGraphDraftMutation

type Document = TypedDocumentNode<MutateSaveAgentGraphDraftResponse, InputVariables<MutateSaveAgentGraphDraftRequest>>

const mutation1: Document = gql`
    mutation SaveAgentGraphDraft($input: SaveAgentGraphDraftInput!) {
        saveAgentGraphDraft(input: $input)
    }
`

enum MutationSaveAgentGraphDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveAgentGraphDraft, Document> = {
    [MutationSaveAgentGraphDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveAgentGraphDraft}. */
type MutateSaveAgentGraphDraftParams = MutateParams<MutationSaveAgentGraphDraft, MutateSaveAgentGraphDraftRequest>

/** The back end `saveAgentGraphDraft` mutation. */
export const mutateSaveAgentGraphDraft = async ({
    mutation = MutationSaveAgentGraphDraft.Mutation1,
    request,
    signal,
}: MutateSaveAgentGraphDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
