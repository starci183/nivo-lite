import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateMoveBookingRequest, MutateMoveBookingResponse } from "./types/move-booking"

const mutation1 = gql`
    mutation MoveBooking($input: MoveBookingInput!) {
        moveBooking(input: $input) {
            id
        }
    }
`

export enum MutationMoveBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMoveBooking, DocumentNode> = {
    [MutationMoveBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateMoveBooking}. */
export type MutationMoveBookingParams = MutateParams<MutationMoveBooking, MutateMoveBookingRequest>

/** Moves a booking to another start time or resource. */
export const mutateMoveBooking = async ({ mutation = MutationMoveBooking.Mutation1, request, signal }: MutationMoveBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateMoveBookingResponse, InputVariables<MutateMoveBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
