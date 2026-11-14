import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DetachAgentProviderMutation, DetachAgentProviderMutationVariables } from "../__generated__/graphql"

/** The input of the `detachAgentProvider` mutation. */
export type MutateDetachAgentProviderRequest = WireInput<DetachAgentProviderMutationVariables["input"]>

/** The response of the `detachAgentProvider` mutation. */
type MutateDetachAgentProviderResponse = DetachAgentProviderMutation

type Document = TypedDocumentNode<MutateDetachAgentProviderResponse, InputVariables<MutateDetachAgentProviderRequest>>

const mutation1: Document = gql`
    mutation DetachAgentProvider($input: DetachAgentProviderInput!) {
        detachAgentProvider(input: $input)
    }
`

enum MutateDetachAgentProviderDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateDetachAgentProviderDocument, Document> = {
    [MutateDetachAgentProviderDocument.Mutation1]: mutation1,
}

type MutateDetachAgentProviderParams = MutateParams<MutateDetachAgentProviderDocument, MutateDetachAgentProviderRequest>

/** Takes a provider off an agent (owner or manager). Rejects with the back end failure. */
export const mutateDetachAgentProvider = async ({
    mutation = MutateDetachAgentProviderDocument.Mutation1,
    request,
    signal,
}: MutateDetachAgentProviderParams): Promise<ApolloClient.MutateResult<MutateDetachAgentProviderResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
