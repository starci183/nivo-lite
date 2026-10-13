import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRevokeApiKeyArgs } from "../__generated__/schema"

/** The input of the `revokeApiKey` mutation. */
export type MutateRevokeApiKeyRequest = MutationRevokeApiKeyArgs["input"]

/** The response of the `revokeApiKey` mutation. */
type MutateRevokeApiKeyResponse = Pick<Mutation, "revokeApiKey">

const mutation1: TypedDocumentNode<MutateRevokeApiKeyResponse, InputVariables<MutateRevokeApiKeyRequest>> = gql`
    mutation RevokeApiKey($input: RevokeApiKeyInput!) {
        revokeApiKey(input: $input) {
            id
            revokedAt
        }
    }
`

enum MutationRevokeApiKey {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRevokeApiKey,
    TypedDocumentNode<MutateRevokeApiKeyResponse, InputVariables<MutateRevokeApiKeyRequest>>
> = {
    [MutationRevokeApiKey.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRevokeApiKey}. */
type MutateRevokeApiKeyParams = MutateParams<MutationRevokeApiKey, MutateRevokeApiKeyRequest>

/** Revokes an API key of the active workspace (the back end `revokeApiKey` mutation). */
export const mutateRevokeApiKey = async ({
    mutation = MutationRevokeApiKey.Mutation1,
    request,
    signal,
}: MutateRevokeApiKeyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
