import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetWorkspaceAgentWorkMutation, SetWorkspaceAgentWorkMutationVariables } from "../__generated__/graphql"

/** The input of the `setWorkspaceAgentWork` mutation. */
export type MutateSetWorkspaceAgentWorkRequest = WireInput<SetWorkspaceAgentWorkMutationVariables["input"]>

type MutateSetWorkspaceAgentWorkResponse = SetWorkspaceAgentWorkMutation

const mutation1: TypedDocumentNode<
    MutateSetWorkspaceAgentWorkResponse,
    InputVariables<MutateSetWorkspaceAgentWorkRequest>
> = gql`
    mutation SetWorkspaceAgentWork($input: SetWorkspaceAgentWorkInput!) {
        setWorkspaceAgentWork(input: $input) {
            agentsOff
            backgroundDailyCap
            heldWakes
            pendingWakes
            road
            workEnabled
        }
    }
`

enum MutationSetWorkspaceAgentWork {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetWorkspaceAgentWork,
    TypedDocumentNode<MutateSetWorkspaceAgentWorkResponse, InputVariables<MutateSetWorkspaceAgentWorkRequest>>
> = {
    [MutationSetWorkspaceAgentWork.Mutation1]: mutation1,
}

/** The back end `setWorkspaceAgentWork` mutation. Switches the work of the whole workspace on or off (owner). */
export const mutateSetWorkspaceAgentWork = async ({
    mutation = MutationSetWorkspaceAgentWork.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetWorkspaceAgentWork, MutateSetWorkspaceAgentWorkRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
