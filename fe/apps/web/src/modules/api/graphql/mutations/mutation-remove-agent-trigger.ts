import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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
}: MutateParams<MutationRemoveAgentTrigger, MutateRemoveAgentTriggerRequest>): Promise<
    ApolloClient.MutateResult<MutateRemoveAgentTriggerResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
