import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AssignAgentWorkMutation, AssignAgentWorkMutationVariables } from "../__generated__/graphql"

/** The input of the `assignAgentWork` mutation. */
type MutateAssignAgentWorkRequest = WireInput<AssignAgentWorkMutationVariables["input"]>

/** The response of the `assignAgentWork` mutation: the typed payload straight from the back end contract. */
type MutateAssignAgentWorkResponse = AssignAgentWorkMutation

type Document = TypedDocumentNode<MutateAssignAgentWorkResponse, InputVariables<MutateAssignAgentWorkRequest>>

const mutation1: Document = gql`
    mutation AssignAgentWork($input: AssignAgentWorkInput!) {
        assignAgentWork(input: $input) {
            threadId
        }
    }
`

enum MutationAssignAgentWork {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAssignAgentWork, Document> = {
    [MutationAssignAgentWork.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAssignAgentWork}. */
type MutateAssignAgentWorkParams = MutateParams<MutationAssignAgentWork, MutateAssignAgentWorkRequest>

/** Hands an agent work (the back end `assignAgentWork` mutation); the server checks the caller may. */
export const mutateAssignAgentWork = async ({
    mutation = MutationAssignAgentWork.Mutation1,
    request,
    signal,
}: MutateAssignAgentWorkParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
