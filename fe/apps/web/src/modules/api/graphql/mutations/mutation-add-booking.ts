import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateAddBookingRequest, MutateAddBookingResponse } from "./types/add-booking"

const mutation1 = gql`
    mutation AddBooking($input: AddBookingInput!) {
        addBooking(input: $input) {
            id
        }
    }
`

export enum MutationAddBooking {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAddBooking, DocumentNode> = {
    [MutationAddBooking.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAddBooking}. */
export type MutationAddBookingParams = MutateParams<MutationAddBooking, MutateAddBookingRequest>

/** Places a booking on the desk (auto-assigns a resource when resourceId is empty; force stacks over a refusal). */
export const mutateAddBooking = async ({ mutation = MutationAddBooking.Mutation1, request, signal }: MutationAddBookingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateAddBookingResponse, InputVariables<MutateAddBookingRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
