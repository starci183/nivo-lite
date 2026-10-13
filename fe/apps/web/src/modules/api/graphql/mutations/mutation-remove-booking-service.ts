import type { RemoveBookingServiceMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRemoveBookingServiceRequest } from "./types/remove-booking-service"

const mutation1 = gql`
    mutation RemoveBookingService($input: RemoveBookingServiceInput!) {
        removeBookingService(input: $input) {
            id
        }
    }
`

enum MutationRemoveBookingService {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveBookingService, DocumentNode> = {
    [MutationRemoveBookingService.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveBookingService}. */
type MutationRemoveBookingServiceParams = MutateParams<MutationRemoveBookingService, MutateRemoveBookingServiceRequest>

/** Removes a booking service. */
export const mutateRemoveBookingService = async ({
    mutation = MutationRemoveBookingService.Mutation1,
    request,
    signal,
}: MutationRemoveBookingServiceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<RemoveBookingServiceMutation, InputVariables<MutateRemoveBookingServiceRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
