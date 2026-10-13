import type { CheckInBookingMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateCheckInBookingRequest } from "./types/check-in-booking"

const mutation1 = gql`
    mutation CheckInBooking($input: CheckInBookingInput!) {
        checkInBooking(input: $input) {
            feeDue
            status
        }
    }
`

enum MutationCheckInBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCheckInBooking, DocumentNode> = {
    [MutationCheckInBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCheckInBooking}. */
type MutationCheckInBookingParams = MutateParams<MutationCheckInBooking, MutateCheckInBookingRequest>

/** Checks a confirmed booking in. */
export const mutateCheckInBooking = async ({
    mutation = MutationCheckInBooking.Mutation1,
    request,
    signal,
}: MutationCheckInBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<CheckInBookingMutation, InputVariables<MutateCheckInBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
