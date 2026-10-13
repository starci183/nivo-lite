import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSimulateInboundArgs } from "../__generated__/schema"

/** The generated input of the simulator mutation. */
export type MutateSimulateInboundRequest = MutationSimulateInboundArgs["input"]

/** The generated selection returned by the simulator mutation. */
type MutateSimulateInboundResponse = Pick<Mutation, "simulateInbound">

type Document = TypedDocumentNode<MutateSimulateInboundResponse, InputVariables<MutateSimulateInboundRequest>>

const mutation1: Document = gql`
    mutation SimulateInbound($input: SimulateInboundInput!) {
        simulateInbound(input: $input) {
            id
            status
            duplicate
        }
    }
`

enum MutationSimulateInbound {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSimulateInbound, Document> = {
    [MutationSimulateInbound.Mutation1]: mutation1,
}

/** Apollo parameters for the simulator mutation. */
type MutateSimulateInboundParams = MutateParams<MutationSimulateInbound, MutateSimulateInboundRequest>

/** Records one simulated delivery and queues its department processing. */
export const mutateSimulateInbound = async ({
    mutation = MutationSimulateInbound.Mutation1,
    request,
    signal,
    headers,
}: MutateSimulateInboundParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
