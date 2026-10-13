import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCreateApiKeyArgs } from "../__generated__/schema"

/** The input of the `createApiKey` mutation. */
export type MutateCreateApiKeyRequest = MutationCreateApiKeyArgs["input"]

/** The response of the `createApiKey` mutation. */
type MutateCreateApiKeyResponse = Pick<Mutation, "createApiKey">

const mutation1: TypedDocumentNode<MutateCreateApiKeyResponse, InputVariables<MutateCreateApiKeyRequest>> = gql`
    mutation CreateApiKey($input: CreateApiKeyInput!) {
        createApiKey(input: $input) {
            key
            item {
                id
                name
                prefix
                createdAt
                lastUsedAt
                revokedAt
            }
        }
    }
`

enum MutationCreateApiKey {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateApiKey,
    TypedDocumentNode<MutateCreateApiKeyResponse, InputVariables<MutateCreateApiKeyRequest>>
> = {
    [MutationCreateApiKey.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateApiKey}. */
type MutateCreateApiKeyParams = MutateParams<MutationCreateApiKey, MutateCreateApiKeyRequest>

/** Creates an API key; the secret is in the answer once and never again (the back end `createApiKey` mutation). */
export const mutateCreateApiKey = async ({
    mutation = MutationCreateApiKey.Mutation1,
    request,
    signal,
}: MutateCreateApiKeyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
