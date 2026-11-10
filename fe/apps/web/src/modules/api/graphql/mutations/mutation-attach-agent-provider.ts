import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AttachAgentProviderMutation, AttachAgentProviderMutationVariables } from "../__generated__/graphql"

/** The input of the `attachAgentProvider` mutation. */
export type MutateAttachAgentProviderRequest = WireInput<AttachAgentProviderMutationVariables["input"]>

/** The response of the `attachAgentProvider` mutation. */
type MutateAttachAgentProviderResponse = AttachAgentProviderMutation

type Document = TypedDocumentNode<MutateAttachAgentProviderResponse, InputVariables<MutateAttachAgentProviderRequest>>

const mutation1: Document = gql`
    mutation AttachAgentProvider($input: AttachAgentProviderInput!) {
        attachAgentProvider(input: $input)
    }
`

enum MutateAttachAgentProviderDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateAttachAgentProviderDocument, Document> = {
    [MutateAttachAgentProviderDocument.Mutation1]: mutation1,
}

type MutateAttachAgentProviderParams = MutateParams<MutateAttachAgentProviderDocument, MutateAttachAgentProviderRequest>

/** Attaches a provider to an agent with the abilities ticked (owner or manager). Rejects with the back end failure. */
export const mutateAttachAgentProvider = async ({
    mutation = MutateAttachAgentProviderDocument.Mutation1,
    request,
    signal,
}: MutateAttachAgentProviderParams): Promise<ApolloClient.MutateResult<MutateAttachAgentProviderResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
