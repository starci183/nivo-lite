import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationProposeShiftsWeekArgs } from "../__generated__/schema"

/** The input of the `proposeShiftsWeek` mutation. */
export type MutateProposeShiftsWeekRequest = MutationProposeShiftsWeekArgs["input"]

/** The response of the `proposeShiftsWeek` mutation. */
type MutateProposeShiftsWeekResponse = Pick<Mutation, "proposeShiftsWeek">

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
