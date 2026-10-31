import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveAgentGoalMutation, SaveAgentGoalMutationVariables } from "../__generated__/graphql"

/** The input of the `saveAgentGoal` mutation. */
export type MutateSaveAgentGoalRequest = WireInput<SaveAgentGoalMutationVariables["input"]>

type MutateSaveAgentGoalResponse = SaveAgentGoalMutation

const mutation1: TypedDocumentNode<MutateSaveAgentGoalResponse, InputVariables<MutateSaveAgentGoalRequest>> = gql`
    mutation SaveAgentGoal($input: SaveAgentGoalInput!) {
        saveAgentGoal(input: $input) {
            detail
            dueAt
            id
            source
            status
            title
        }
    }
`

enum MutationSaveAgentGoal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveAgentGoal, TypedDocumentNode<MutateSaveAgentGoalResponse, InputVariables<MutateSaveAgentGoalRequest>>> = {
    [MutationSaveAgentGoal.Mutation1]: mutation1,
}

/** The back end `saveAgentGoal` mutation. Adds a goal to an agent or changes one. */
export const mutateSaveAgentGoal = async ({
    mutation = MutationSaveAgentGoal.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveAgentGoal, MutateSaveAgentGoalRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
