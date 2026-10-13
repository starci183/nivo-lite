import type { CancelBookingMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateCancelBookingRequest } from "./types/cancel-booking"

const mutation1 = gql`
    mutation CancelBooking($input: CancelBookingInput!) {
        cancelBooking(input: $input) {
            feeDue
            status
        }
    }
`

enum MutationCancelBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCancelBooking, DocumentNode> = {
    [MutationCancelBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCancelBooking}. */
type MutationCancelBookingParams = MutateParams<MutationCancelBooking, MutateCancelBookingRequest>

/** Cancels a booking. */
export const mutateCancelBooking = async ({
    mutation = MutationCancelBooking.Mutation1,
    request,
    signal,
}: MutationCancelBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<CancelBookingMutation, InputVariables<MutateCancelBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
