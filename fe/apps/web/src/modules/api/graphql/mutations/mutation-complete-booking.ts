import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateCompleteBookingRequest, MutateCompleteBookingResponse } from "./types/complete-booking"

const mutation1 = gql`
    mutation CompleteBooking($input: CompleteBookingInput!) {
        completeBooking(input: $input) {
            feeDue status
        }
    }
`

export enum MutationCompleteBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCompleteBooking, DocumentNode> = {
    [MutationCompleteBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCompleteBooking}. */
export type MutationCompleteBookingParams = MutateParams<MutationCompleteBooking, MutateCompleteBookingRequest>

/** Marks a booking done. */
export const mutateCompleteBooking = async ({ mutation = MutationCompleteBooking.Mutation1, request, signal }: MutationCompleteBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateCompleteBookingResponse, InputVariables<MutateCompleteBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
