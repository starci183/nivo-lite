import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RevealSepayKeyMutation, RevealSepayKeyMutationVariables } from "../__generated__/graphql"

/** The input of the `revealSepayKey` mutation. */
export type MutateRevealSepayKeyRequest = WireInput<RevealSepayKeyMutationVariables["input"]>

/** The response of the `revealSepayKey` mutation. */
type MutateRevealSepayKeyResponse = RevealSepayKeyMutation

const mutation1: TypedDocumentNode<MutateRevealSepayKeyResponse, InputVariables<MutateRevealSepayKeyRequest>> = gql`
    mutation RevealSepayKey($input: RevealSepayKeyInput!) {
        revealSepayKey(input: $input) {
            apiKey
            webhookUrl
        }
    }
`

enum MutationRevealSepayKey {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRevealSepayKey,
    TypedDocumentNode<MutateRevealSepayKeyResponse, InputVariables<MutateRevealSepayKeyRequest>>
> = {
    [MutationRevealSepayKey.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRevealSepayKey}. */
type MutateRevealSepayKeyParams = MutateParams<MutationRevealSepayKey, MutateRevealSepayKeyRequest>

/** Reveals the SePay webhook address and key. */
export const mutateRevealSepayKey = async ({
    mutation = MutationRevealSepayKey.Mutation1,
    request,
    signal,
}: MutateRevealSepayKeyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
