import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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
}: MutateSaveAgentGraphDraftParams): Promise<ApolloClient.MutateResult<MutateSaveAgentGraphDraftResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
