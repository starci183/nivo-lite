import type { RemoveBookingExceptionMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRemoveBookingExceptionRequest } from "./types/remove-booking-exception"

const mutation1 = gql`
    mutation RemoveBookingException($input: RemoveBookingExceptionInput!) {
        removeBookingException(input: $input) {
            id
        }
    }
`

enum MutationRemoveBookingException {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveBookingException, DocumentNode> = {
    [MutationRemoveBookingException.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveBookingException}. */
type MutationRemoveBookingExceptionParams = MutateParams<
    MutationRemoveBookingException,
    MutateRemoveBookingExceptionRequest
>

/** Removes a date exception. */
export const mutateRemoveBookingException = async ({
    mutation = MutationRemoveBookingException.Mutation1,
    request,
    signal,
}: MutationRemoveBookingExceptionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<RemoveBookingExceptionMutation, InputVariables<MutateRemoveBookingExceptionRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
