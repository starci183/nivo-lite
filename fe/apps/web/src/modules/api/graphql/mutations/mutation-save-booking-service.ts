import type { SaveBookingServiceMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingServiceRequest } from "./types/save-booking-service"

const mutation1 = gql`
    mutation SaveBookingService($input: SaveBookingServiceInput!) {
        saveBookingService(input: $input) {
            id
        }
    }
`

enum MutationSaveBookingService {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingService, DocumentNode> = {
    [MutationSaveBookingService.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingService}. */
type MutationSaveBookingServiceParams = MutateParams<MutationSaveBookingService, MutateSaveBookingServiceRequest>

/** Creates or updates a booking service (id null creates). */
export const mutateSaveBookingService = async ({
    mutation = MutationSaveBookingService.Mutation1,
    request,
    signal,
}: MutationSaveBookingServiceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SaveBookingServiceMutation, InputVariables<MutateSaveBookingServiceRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
