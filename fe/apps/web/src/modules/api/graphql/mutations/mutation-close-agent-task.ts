import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CloseAgentTaskMutation, CloseAgentTaskMutationVariables } from "../__generated__/graphql"

/** The input of the `closeAgentTask` mutation. */
export type MutateCloseAgentTaskRequest = WireInput<CloseAgentTaskMutationVariables["input"]>

type MutateCloseAgentTaskResponse = CloseAgentTaskMutation

const mutation1: TypedDocumentNode<MutateCloseAgentTaskResponse, InputVariables<MutateCloseAgentTaskRequest>> = gql`
    mutation CloseAgentTask($input: CloseAgentTaskInput!) {
        closeAgentTask(input: $input) {
            ok
        }
    }
`

enum MutationCloseAgentTask {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCloseAgentTask,
    TypedDocumentNode<MutateCloseAgentTaskResponse, InputVariables<MutateCloseAgentTaskRequest>>
> = {
    [MutationCloseAgentTask.Mutation1]: mutation1,
}

/** The back end `closeAgentTask` mutation. Closes a task of an agent. */
export const mutateCloseAgentTask = async ({
    mutation = MutationCloseAgentTask.Mutation1,
    request,
    signal,
}: MutateParams<MutationCloseAgentTask, MutateCloseAgentTaskRequest>): Promise<
    ApolloClient.MutateResult<MutateCloseAgentTaskResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
