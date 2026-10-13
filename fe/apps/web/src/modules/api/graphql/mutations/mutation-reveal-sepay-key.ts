import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRevealSepayKeyArgs } from "../__generated__/schema"

/** The input of the `revealSepayKey` mutation. */
export type MutateRevealSepayKeyRequest = MutationRevealSepayKeyArgs["input"]

/** The response of the `revealSepayKey` mutation. */
type MutateRevealSepayKeyResponse = Pick<Mutation, "revealSepayKey">

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
