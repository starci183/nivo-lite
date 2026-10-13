import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateConfirmBookingRequest, MutateConfirmBookingResponse } from "./types/confirm-booking"

const mutation1 = gql`
    mutation ConfirmBooking($input: ConfirmBookingInput!) {
        confirmBooking(input: $input) {
            feeDue status
        }
    }
`

export enum MutationConfirmBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationConfirmBooking, DocumentNode> = {
    [MutationConfirmBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateConfirmBooking}. */
export type MutationConfirmBookingParams = MutateParams<MutationConfirmBooking, MutateConfirmBookingRequest>

/** Confirms a requested booking. */
export const mutateConfirmBooking = async ({ mutation = MutationConfirmBooking.Mutation1, request, signal }: MutationConfirmBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateConfirmBookingResponse, InputVariables<MutateConfirmBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
