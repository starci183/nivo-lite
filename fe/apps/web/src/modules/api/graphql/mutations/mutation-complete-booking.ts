import type { CompleteBookingMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateCompleteBookingRequest } from "./types/complete-booking"

const mutation1 = gql`
    mutation CompleteBooking($input: CompleteBookingInput!) {
        completeBooking(input: $input) {
            feeDue
            status
        }
    }
`

enum MutationCompleteBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCompleteBooking, DocumentNode> = {
    [MutationCompleteBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCompleteBooking}. */
type MutationCompleteBookingParams = MutateParams<MutationCompleteBooking, MutateCompleteBookingRequest>

/** Marks a booking done. */
export const mutateCompleteBooking = async ({
    mutation = MutationCompleteBooking.Mutation1,
    request,
    signal,
}: MutationCompleteBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<CompleteBookingMutation, InputVariables<MutateCompleteBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
