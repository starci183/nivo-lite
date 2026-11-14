import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RenameApiKeyMutation, RenameApiKeyMutationVariables } from "../__generated__/graphql"

/** The input of the `renameApiKey` mutation. */
export type MutateRenameApiKeyRequest = WireInput<RenameApiKeyMutationVariables["input"]>

/** The response of the `renameApiKey` mutation. */
type MutateRenameApiKeyResponse = RenameApiKeyMutation

const mutation1: TypedDocumentNode<MutateRenameApiKeyResponse, InputVariables<MutateRenameApiKeyRequest>> = gql`
    mutation RenameApiKey($input: RenameApiKeyInput!) {
        renameApiKey(input: $input) {
            id
            name
        }
    }
`

enum MutationRenameApiKey {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRenameApiKey,
    TypedDocumentNode<MutateRenameApiKeyResponse, InputVariables<MutateRenameApiKeyRequest>>
> = {
    [MutationRenameApiKey.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRenameApiKey}. */
type MutateRenameApiKeyParams = MutateParams<MutationRenameApiKey, MutateRenameApiKeyRequest>

/** Renames an API key of the active workspace (the back end `renameApiKey` mutation). */
export const mutateRenameApiKey = async ({
    mutation = MutationRenameApiKey.Mutation1,
    request,
    signal,
}: MutateRenameApiKeyParams): Promise<ApolloClient.MutateResult<MutateRenameApiKeyResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
