import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateMarkBookingNoShowRequest, MutateMarkBookingNoShowResponse } from "./types/mark-booking-no-show"

const mutation1 = gql`
    mutation MarkBookingNoShow($input: MarkBookingNoShowInput!) {
        markBookingNoShow(input: $input) {
            feeDue status
        }
    }
`

export enum MutationMarkBookingNoShow {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMarkBookingNoShow, DocumentNode> = {
    [MutationMarkBookingNoShow.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateMarkBookingNoShow}. */
export type MutationMarkBookingNoShowParams = MutateParams<MutationMarkBookingNoShow, MutateMarkBookingNoShowRequest>

/** Marks a booking as a no-show. */
export const mutateMarkBookingNoShow = async ({ mutation = MutationMarkBookingNoShow.Mutation1, request, signal }: MutationMarkBookingNoShowParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateMarkBookingNoShowResponse, InputVariables<MutateMarkBookingNoShowRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
