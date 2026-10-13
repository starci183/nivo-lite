import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ProposeShiftsWeekMutation, ProposeShiftsWeekMutationVariables } from "../__generated__/graphql"

/** The input of the `proposeShiftsWeek` mutation. */
export type MutateProposeShiftsWeekRequest = WireInput<ProposeShiftsWeekMutationVariables["input"]>

/** The response of the `proposeShiftsWeek` mutation. */
type MutateProposeShiftsWeekResponse = ProposeShiftsWeekMutation

const mutation1: TypedDocumentNode<
    MutateProposeShiftsWeekResponse,
    InputVariables<MutateProposeShiftsWeekRequest>
> = gql`
    mutation ProposeShiftsWeek($input: ProposeShiftsWeekInput!) {
        proposeShiftsWeek(input: $input) {
            costVnd
            open
            scheduleId
            shifts
            short
            version
        }
    }
`

enum MutationProposeShiftsWeek {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationProposeShiftsWeek,
    TypedDocumentNode<MutateProposeShiftsWeekResponse, InputVariables<MutateProposeShiftsWeekRequest>>
> = {
    [MutationProposeShiftsWeek.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateProposeShiftsWeek}. */
type MutateProposeShiftsWeekParams = MutateParams<MutationProposeShiftsWeek, MutateProposeShiftsWeekRequest>

/** Runs the `proposeShiftsWeek` mutation. */
export const mutateProposeShiftsWeek = async ({
    mutation = MutationProposeShiftsWeek.Mutation1,
    request,
    signal,
}: MutateProposeShiftsWeekParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
