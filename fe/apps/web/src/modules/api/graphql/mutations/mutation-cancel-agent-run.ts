import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CancelAgentRunMutation, CancelAgentRunMutationVariables } from "../__generated__/graphql"

/** The input of the `cancelAgentRun` mutation. */
export type MutateCancelAgentRunRequest = WireInput<CancelAgentRunMutationVariables["input"]>

type MutateCancelAgentRunResponse = CancelAgentRunMutation

const mutation1: TypedDocumentNode<MutateCancelAgentRunResponse, InputVariables<MutateCancelAgentRunRequest>> = gql`
    mutation CancelAgentRun($input: CancelAgentRunInput!) {
        cancelAgentRun(input: $input) {
            kind
            note
        }
    }
`

enum MutationCancelAgentRun {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCancelAgentRun,
    TypedDocumentNode<MutateCancelAgentRunResponse, InputVariables<MutateCancelAgentRunRequest>>
> = {
    [MutationCancelAgentRun.Mutation1]: mutation1,
}

/** The back end `cancelAgentRun` mutation. Stops a queued, running or waiting run; what it already sent is not undone. */
export const mutateCancelAgentRun = async ({
    mutation = MutationCancelAgentRun.Mutation1,
    request,
    signal,
}: MutateParams<MutationCancelAgentRun, MutateCancelAgentRunRequest>): Promise<
    ApolloClient.MutateResult<MutateCancelAgentRunResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
