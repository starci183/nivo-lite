import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SaveCrmConnectionMutation, SaveCrmConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `saveCrmConnection` mutation. */
export type MutateSaveCrmConnectionRequest = WireInput<SaveCrmConnectionMutationVariables["input"]>

/** The response of the `saveCrmConnection` mutation: what saving came to, never the key. */
type MutateSaveCrmConnectionResponse = SaveCrmConnectionMutation

const mutation1: TypedDocumentNode<MutateSaveCrmConnectionResponse, InputVariables<MutateSaveCrmConnectionRequest>> = gql`
    mutation SaveCrmConnection($input: SaveCrmConnectionInput!) {
        saveCrmConnection(input: $input) {
            connectionId
            templated
            compatible
            driftFromTemplate
            pin {
                connector
                swaggerUrl
                documentSha256
                pinnedAt
                live
                needed {
                    op
                    state
                    method
                    path
                    effect
                }
                others {
                    op
                    method
                    path
                }
            }
        }
    }
`

enum MutationSaveCrmConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveCrmConnection,
    TypedDocumentNode<MutateSaveCrmConnectionResponse, InputVariables<MutateSaveCrmConnectionRequest>>
> = {
    [MutationSaveCrmConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveCrmConnection}. */
type MutateSaveCrmConnectionParams = MutateParams<MutationSaveCrmConnection, MutateSaveCrmConnectionRequest>

/** Connects or updates a CRM provider via OpenAPI: the engine fetches and pins the live Swagger document and answers the compatibility. */
export const mutateSaveCrmConnection = async ({
    mutation = MutationSaveCrmConnection.Mutation1,
    request,
    signal,
}: MutateSaveCrmConnectionParams): Promise<ApolloClient.MutateResult<MutateSaveCrmConnectionResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
