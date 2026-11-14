import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DecideRunStopMutation, DecideRunStopMutationVariables } from "../__generated__/graphql"

/** The input of the `decideRunStop` mutation. */
export type MutateDecideRunStopRequest = WireInput<DecideRunStopMutationVariables["input"]>

type MutateDecideRunStopResponse = DecideRunStopMutation

const mutation1: TypedDocumentNode<MutateDecideRunStopResponse, InputVariables<MutateDecideRunStopRequest>> = gql`
    mutation DecideRunStop($input: DecideRunStopInput!) {
        decideRunStop(input: $input) {
            outcome
            stepKey
            refusal {
                stopId
                workItemId
                door
                verdicts
            }
        }
    }
`

enum MutationDecideRunStop {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideRunStop,
    TypedDocumentNode<MutateDecideRunStopResponse, InputVariables<MutateDecideRunStopRequest>>
> = {
    [MutationDecideRunStop.Mutation1]: mutation1,
}

/** The back end `decideRunStop` mutation: answer the step a run stopped on, retry it, take it over, or skip it. */
export const mutateDecideRunStop = async ({
    mutation = MutationDecideRunStop.Mutation1,
    request,
    signal,
    headers,
}: MutateParams<MutationDecideRunStop, MutateDecideRunStopRequest>): Promise<
    ApolloClient.MutateResult<MutateDecideRunStopResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request }, context: { headers } })
}
