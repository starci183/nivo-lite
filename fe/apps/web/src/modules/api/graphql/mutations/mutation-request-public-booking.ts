import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRequestPublicBookingRequest, MutateRequestPublicBookingResponse } from "./types/request-public-booking"

const mutation1 = gql`
    mutation RequestPublicBooking($input: RequestPublicBookingInput!) {
        requestPublicBooking(input: $input) {
            alternatives bookingId code serviceName startIso state
        }
    }
`

export enum MutationRequestPublicBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestPublicBooking, DocumentNode> = {
    [MutationRequestPublicBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestPublicBooking}. */
export type MutationRequestPublicBookingParams = MutateParams<MutationRequestPublicBooking, MutateRequestPublicBookingRequest>

/** Sends one public booking request (idempotent on token; website is the bot trap). */
export const mutateRequestPublicBooking = async ({ mutation = MutationRequestPublicBooking.Mutation1, request, signal }: MutationRequestPublicBookingParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate<MutateRequestPublicBookingResponse, InputVariables<MutateRequestPublicBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
