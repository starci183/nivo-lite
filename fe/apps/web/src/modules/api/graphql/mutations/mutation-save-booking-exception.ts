import type { SaveBookingExceptionMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingExceptionRequest } from "./types/save-booking-exception"

const mutation1 = gql`
    mutation SaveBookingException($input: SaveBookingExceptionInput!) {
        saveBookingException(input: $input) {
            id
        }
    }
`

enum MutationSaveBookingException {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingException, DocumentNode> = {
    [MutationSaveBookingException.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingException}. */
type MutationSaveBookingExceptionParams = MutateParams<MutationSaveBookingException, MutateSaveBookingExceptionRequest>

/** Adds a closing or a special opening window on one date. */
export const mutateSaveBookingException = async ({
    mutation = MutationSaveBookingException.Mutation1,
    request,
    signal,
}: MutationSaveBookingExceptionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SaveBookingExceptionMutation, InputVariables<MutateSaveBookingExceptionRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
