import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideSetupCardArgs } from "../__generated__/schema"

/** The input of the `decideSetupCard` mutation. */
export type MutateDecideSetupCardRequest = MutationDecideSetupCardArgs["input"]

type MutateDecideSetupCardResponse = Pick<Mutation, "decideSetupCard">

const mutation1: TypedDocumentNode<MutateDecideSetupCardResponse, InputVariables<MutateDecideSetupCardRequest>> = gql`
    mutation DecideSetupCard($input: DecideSetupCardInput!) {
        decideSetupCard(input: $input) {
            createdAt
            decidedBy
            gateKey
            id
            kind
            payload
            result
            setupSessionId
            sourceMessageId
            status
            targetKey
            workspaceId
        }
    }
`

enum MutationDecideSetupCard {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideSetupCard,
    TypedDocumentNode<MutateDecideSetupCardResponse, InputVariables<MutateDecideSetupCardRequest>>
> = {
    [MutationDecideSetupCard.Mutation1]: mutation1,
}

/** The back end `decideSetupCard` mutation. */
export const mutateDecideSetupCard = async ({
    mutation = MutationDecideSetupCard.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideSetupCard, MutateDecideSetupCardRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
