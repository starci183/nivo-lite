import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRemoveBookingWaitlistEntryRequest, MutateRemoveBookingWaitlistEntryResponse } from "./types/remove-booking-waitlist-entry"

const mutation1 = gql`
    mutation RemoveBookingWaitlistEntry($input: RemoveBookingWaitlistEntryInput!) {
        removeBookingWaitlistEntry(input: $input) {
            id
        }
    }
`

export enum MutationRemoveBookingWaitlistEntry {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveBookingWaitlistEntry, DocumentNode> = {
    [MutationRemoveBookingWaitlistEntry.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveBookingWaitlistEntry}. */
export type MutationRemoveBookingWaitlistEntryParams = MutateParams<MutationRemoveBookingWaitlistEntry, MutateRemoveBookingWaitlistEntryRequest>

/** Removes one entry of the waiting list. */
export const mutateRemoveBookingWaitlistEntry = async ({ mutation = MutationRemoveBookingWaitlistEntry.Mutation1, request, signal }: MutationRemoveBookingWaitlistEntryParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateRemoveBookingWaitlistEntryResponse, InputVariables<MutateRemoveBookingWaitlistEntryRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
