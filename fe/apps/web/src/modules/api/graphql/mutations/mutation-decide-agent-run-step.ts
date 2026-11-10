import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideAgentRunStepMutation, DecideAgentRunStepMutationVariables } from "../__generated__/graphql"

/** The input of the `decideAgentRunStep` mutation. */
export type MutateDecideAgentRunStepRequest = WireInput<DecideAgentRunStepMutationVariables["input"]>

type MutateDecideAgentRunStepResponse = DecideAgentRunStepMutation

const mutation1: TypedDocumentNode<MutateDecideAgentRunStepResponse, InputVariables<MutateDecideAgentRunStepRequest>> = gql`
    mutation DecideAgentRunStep($input: DecideAgentRunStepInput!) {
        decideAgentRunStep(input: $input) {
            ok
            refusal
        }
    }
`

enum MutationDecideAgentRunStep {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideAgentRunStep,
    TypedDocumentNode<MutateDecideAgentRunStepResponse, InputVariables<MutateDecideAgentRunStepRequest>>
> = {
    [MutationDecideAgentRunStep.Mutation1]: mutation1,
}

/** The back end `decideAgentRunStep` mutation. Approves, retries or refuses the decision a run waits on. */
export const mutateDecideAgentRunStep = async ({
    mutation = MutationDecideAgentRunStep.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideAgentRunStep, MutateDecideAgentRunStepRequest>): Promise<
    ApolloClient.MutateResult<MutateDecideAgentRunStepResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
