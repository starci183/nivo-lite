import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetAgentWorkMutation, SetAgentWorkMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentWork` mutation. */
export type MutateSetAgentWorkRequest = WireInput<SetAgentWorkMutationVariables["input"]>

type MutateSetAgentWorkResponse = SetAgentWorkMutation

const mutation1: TypedDocumentNode<MutateSetAgentWorkResponse, InputVariables<MutateSetAgentWorkRequest>> = gql`
    mutation SetAgentWork($input: SetAgentWorkInput!) {
        setAgentWork(input: $input) {
            agentId
            backgroundTurns
            breakerUntil
            failures
            lastTurnAt
            workEnabled
        }
    }
`

enum MutationSetAgentWork {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetAgentWork,
    TypedDocumentNode<MutateSetAgentWorkResponse, InputVariables<MutateSetAgentWorkRequest>>
> = {
    [MutationSetAgentWork.Mutation1]: mutation1,
}

/** The back end `setAgentWork` mutation. Switches the work of one agent on or off (owner). */
export const mutateSetAgentWork = async ({
    mutation = MutationSetAgentWork.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetAgentWork, MutateSetAgentWorkRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
