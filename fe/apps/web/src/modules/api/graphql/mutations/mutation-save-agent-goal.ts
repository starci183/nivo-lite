import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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

const mutationMap: Record<
    MutationSaveAgentGoal,
    TypedDocumentNode<MutateSaveAgentGoalResponse, InputVariables<MutateSaveAgentGoalRequest>>
> = {
    [MutationSaveAgentGoal.Mutation1]: mutation1,
}

/** The back end `saveAgentGoal` mutation. Adds a goal to an agent or changes one. */
export const mutateSaveAgentGoal = async ({
    mutation = MutationSaveAgentGoal.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveAgentGoal, MutateSaveAgentGoalRequest>): Promise<
    ApolloClient.MutateResult<MutateSaveAgentGoalResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
