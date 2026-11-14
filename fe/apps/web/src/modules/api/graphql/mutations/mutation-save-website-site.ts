import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SaveWebsiteSiteMutation, SaveWebsiteSiteMutationVariables } from "../__generated__/graphql"

/** Generated input of the SaveWebsiteSite mutation. */
export type MutateSaveWebsiteSiteRequest = WireInput<SaveWebsiteSiteMutationVariables["input"]>

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

/** Changes the switches and the agent of the website intake; owner or manager. Rejects with the back end failure. */
export const mutateSaveWebsiteSite = async ({
    mutation = MutationSaveWebsiteSite.Mutation1,
    request,
    signal,
}: MutateSaveWebsiteSiteParams): Promise<ApolloClient.MutateResult<MutateSaveWebsiteSiteResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
