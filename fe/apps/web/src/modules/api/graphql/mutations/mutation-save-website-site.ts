import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveWebsiteSiteMutation, SaveWebsiteSiteMutationVariables } from "../__generated__/graphql"

/** Generated input of the SaveWebsiteSite mutation. */
type MutateSaveWebsiteSiteRequest = WireInput<SaveWebsiteSiteMutationVariables["input"]>

type MutateSaveWebsiteSiteResponse = SaveWebsiteSiteMutation

type Document = TypedDocumentNode<MutateSaveWebsiteSiteResponse, InputVariables<MutateSaveWebsiteSiteRequest>>

const mutation1: Document = gql`
    mutation SaveWebsiteSite($input: SaveWebsiteSiteInput!) {
        saveWebsiteSite(input: $input) {
            siteKey
            isEnabled
            chatEnabled
            formEnabled
            pricesEnabled
            agentId
            formUrl
        }
    }
`

enum MutationSaveWebsiteSite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveWebsiteSite, Document> = { [MutationSaveWebsiteSite.Mutation1]: mutation1 }

/** Parameters of the SaveWebsiteSite mutation. */
type MutateSaveWebsiteSiteParams = MutateParams<MutationSaveWebsiteSite, MutateSaveWebsiteSiteRequest>

/** Changes the switches and the agent of the website intake; owner or manager. */
export const mutateSaveWebsiteSite = async ({
    mutation = MutationSaveWebsiteSite.Mutation1,
    request,
    signal,
    headers,
}: MutateSaveWebsiteSiteParams): Promise<ApolloClient.MutateResult<MutateSaveWebsiteSiteResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
