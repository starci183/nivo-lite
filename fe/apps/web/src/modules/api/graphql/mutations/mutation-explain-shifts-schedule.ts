import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ExplainShiftsScheduleMutation, ExplainShiftsScheduleMutationVariables } from "../__generated__/graphql"

/** The input of the `explainShiftsSchedule` mutation. */
export type MutateExplainShiftsScheduleRequest = WireInput<ExplainShiftsScheduleMutationVariables["input"]>

/** The response of the `explainShiftsSchedule` mutation. */
type MutateExplainShiftsScheduleResponse = ExplainShiftsScheduleMutation

const mutation1: TypedDocumentNode<
    MutateExplainShiftsScheduleResponse,
    InputVariables<MutateExplainShiftsScheduleRequest>
> = gql`
    mutation ExplainShiftsSchedule($input: ShiftsScheduleRefInput!) {
        explainShiftsSchedule(input: $input) {
            explanation
        }
    }
`

enum MutationExplainShiftsSchedule {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationExplainShiftsSchedule,
    TypedDocumentNode<MutateExplainShiftsScheduleResponse, InputVariables<MutateExplainShiftsScheduleRequest>>
> = {
    [MutationExplainShiftsSchedule.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateExplainShiftsSchedule}. */
type MutateExplainShiftsScheduleParams = MutateParams<MutationExplainShiftsSchedule, MutateExplainShiftsScheduleRequest>

/** Runs the `explainShiftsSchedule` mutation. */
export const mutateExplainShiftsSchedule = async ({
    mutation = MutationExplainShiftsSchedule.Mutation1,
    request,
    signal,
}: MutateExplainShiftsScheduleParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
