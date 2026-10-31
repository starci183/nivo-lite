import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RotateSepayKeyMutation, RotateSepayKeyMutationVariables } from "../__generated__/graphql"

/** The input of the `rotateSepayKey` mutation. */
type MutateRotateSepayKeyRequest = WireInput<RotateSepayKeyMutationVariables["input"]>

/** The response of the `rotateSepayKey` mutation. */
type MutateRotateSepayKeyResponse = RotateSepayKeyMutation

const mutation1: TypedDocumentNode<MutateRotateSepayKeyResponse, InputVariables<MutateRotateSepayKeyRequest>> = gql`
    mutation RotateSepayKey($input: RotateSepayKeyInput!) {
        rotateSepayKey(input: $input) {
            apiKey
            webhookUrl
        }
    }
`

enum MutationRotateSepayKey {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRotateSepayKey,
    TypedDocumentNode<MutateRotateSepayKeyResponse, InputVariables<MutateRotateSepayKeyRequest>>
> = {
    [MutationRotateSepayKey.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRotateSepayKey}. */
type MutateRotateSepayKeyParams = MutateParams<MutationRotateSepayKey, MutateRotateSepayKeyRequest>

/** Issues a new SePay API key and answers it with the webhook address. */
export const mutateRotateSepayKey = async ({
    mutation = MutationRotateSepayKey.Mutation1,
    request,
    signal,
}: MutateRotateSepayKeyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
