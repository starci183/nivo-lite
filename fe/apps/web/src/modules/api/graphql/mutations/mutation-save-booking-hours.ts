import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingHoursRequest, MutateSaveBookingHoursResponse } from "./types/save-booking-hours"

const mutation1 = gql`
    mutation SaveBookingHours($input: SaveBookingHoursInput!) {
        saveBookingHours(input: $input) {
            id
        }
    }
`

export enum MutationSaveBookingHours {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingHours, DocumentNode> = {
    [MutationSaveBookingHours.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingHours}. */
export type MutationSaveBookingHoursParams = MutateParams<MutationSaveBookingHours, MutateSaveBookingHoursRequest>

/** Replaces the weekly hours of one resource. */
export const mutateSaveBookingHours = async ({ mutation = MutationSaveBookingHours.Mutation1, request, signal }: MutationSaveBookingHoursParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateSaveBookingHoursResponse, InputVariables<MutateSaveBookingHoursRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
