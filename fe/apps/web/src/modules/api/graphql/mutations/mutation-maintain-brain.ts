import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { MaintainBrainMutation } from "../__generated__/graphql"

/** The response of the `maintainBrain` mutation: the typed payload straight from the back end contract. */
type MutateMaintainBrainResponse = MaintainBrainMutation

const mutation1: TypedDocumentNode<MutateMaintainBrainResponse> = gql`
    mutation MaintainBrain {
        maintainBrain
    }
`

enum MutationMaintainBrain {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMaintainBrain, TypedDocumentNode<MutateMaintainBrainResponse>> = {
    [MutationMaintainBrain.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateMaintainBrain}: no input, the workspace header scopes it. */
type MutateMaintainBrainParams = Omit<MutateParams<MutationMaintainBrain, undefined>, "request">

/**
 * Brings the shared brain up to date: applies the scheduled values that are due and expires the values that ended
 * (the back end `maintainBrain` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized
 * by the server).
 */
export const mutateMaintainBrain = async ({
    mutation = MutationMaintainBrain.Mutation1,
    signal,
}: MutateMaintainBrainParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
