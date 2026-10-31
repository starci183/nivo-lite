import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RemoveAgentTriggerMutation, RemoveAgentTriggerMutationVariables } from "../__generated__/graphql"

/** The input of the `removeAgentTrigger` mutation. */
export type MutateRemoveAgentTriggerRequest = WireInput<RemoveAgentTriggerMutationVariables["input"]>

type MutateRemoveAgentTriggerResponse = RemoveAgentTriggerMutation

const mutation1: TypedDocumentNode<
    MutateRemoveAgentTriggerResponse,
    InputVariables<MutateRemoveAgentTriggerRequest>
> = gql`
    mutation RemoveAgentTrigger($input: RemoveAgentTriggerInput!) {
        removeAgentTrigger(input: $input) {
            ok
        }
    }
`

enum MutationRemoveAgentTrigger {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRemoveAgentTrigger,
    TypedDocumentNode<MutateRemoveAgentTriggerResponse, InputVariables<MutateRemoveAgentTriggerRequest>>
> = {
    [MutationRemoveAgentTrigger.Mutation1]: mutation1,
}

/** The back end `removeAgentTrigger` mutation. Removes a trigger of an agent. */
export const mutateRemoveAgentTrigger = async ({
    mutation = MutationRemoveAgentTrigger.Mutation1,
    request,
    signal,
}: MutateParams<MutationRemoveAgentTrigger, MutateRemoveAgentTriggerRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
