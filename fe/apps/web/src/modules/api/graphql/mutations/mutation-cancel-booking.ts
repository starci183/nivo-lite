import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateCancelBookingRequest, MutateCancelBookingResponse } from "./types/cancel-booking"

const mutation1 = gql`
    mutation CancelBooking($input: CancelBookingInput!) {
        cancelBooking(input: $input) {
            feeDue status
        }
    }
`

export enum MutationCancelBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCancelBooking, DocumentNode> = {
    [MutationCancelBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCancelBooking}. */
export type MutationCancelBookingParams = MutateParams<MutationCancelBooking, MutateCancelBookingRequest>

/** Cancels a booking. */
export const mutateCancelBooking = async ({ mutation = MutationCancelBooking.Mutation1, request, signal }: MutationCancelBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateCancelBookingResponse, InputVariables<MutateCancelBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
