import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SyncMcpConnectorMutation, SyncMcpConnectorMutationVariables } from "../__generated__/graphql"

/** The input of the `syncMcpConnector` mutation. */
export type MutateSyncMcpConnectorRequest = WireInput<SyncMcpConnectorMutationVariables["input"]>

type MutateSyncMcpConnectorResponse = SyncMcpConnectorMutation

const mutation1: TypedDocumentNode<MutateSyncMcpConnectorResponse, InputVariables<MutateSyncMcpConnectorRequest>> = gql`
    mutation SyncMcpConnector($input: SyncMcpConnectorInput!) {
        syncMcpConnector(input: $input)
    }
`

enum MutationSyncMcpConnector {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSyncMcpConnector,
    TypedDocumentNode<MutateSyncMcpConnectorResponse, InputVariables<MutateSyncMcpConnectorRequest>>
> = {
    [MutationSyncMcpConnector.Mutation1]: mutation1,
}

/** The back end `syncMcpConnector` mutation: reads the live tool list of a remote connector; answers the tool count. */
export const mutateSyncMcpConnector = async ({
    mutation = MutationSyncMcpConnector.Mutation1,
    request,
    signal,
}: MutateParams<MutationSyncMcpConnector, MutateSyncMcpConnectorRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
