import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveZaloOaSecretMutation, SaveZaloOaSecretMutationVariables } from "../__generated__/graphql"

/** The input of the `saveZaloOaSecret` mutation. */
export type MutateSaveZaloOaSecretRequest = WireInput<SaveZaloOaSecretMutationVariables["input"]>

/** The response of the `saveZaloOaSecret` mutation. */
type MutateSaveZaloOaSecretResponse = SaveZaloOaSecretMutation

const mutation1: TypedDocumentNode<MutateSaveZaloOaSecretResponse, InputVariables<MutateSaveZaloOaSecretRequest>> = gql`
    mutation SaveZaloOaSecret($input: SaveZaloOaSecretInput!) {
        saveZaloOaSecret(input: $input) {
            id
            name
            status
            webhookUrl
            callbackUrl
            authorized
            oaSecretSaved
            oaId
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum MutationSaveZaloOaSecret {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveZaloOaSecret,
    TypedDocumentNode<MutateSaveZaloOaSecretResponse, InputVariables<MutateSaveZaloOaSecretRequest>>
> = {
    [MutationSaveZaloOaSecret.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveZaloOaSecret}. */
type MutateSaveZaloOaSecretParams = MutateParams<MutationSaveZaloOaSecret, MutateSaveZaloOaSecretRequest>

/** Saves the Zalo OA secret key. */
export const mutateSaveZaloOaSecret = async ({
    mutation = MutationSaveZaloOaSecret.Mutation1,
    request,
    signal,
}: MutateSaveZaloOaSecretParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
