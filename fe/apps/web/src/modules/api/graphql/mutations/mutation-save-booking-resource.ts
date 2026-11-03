import type { SaveBookingResourceMutation } from "../__generated__/graphql"
import { gql, type ApolloClient } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingResourceRequest } from "./types/save-booking-resource"

const mutation1 = gql`
    mutation SaveBookingResource($input: SaveBookingResourceInput!) {
        saveBookingResource(input: $input) {
            id
        }
    }
`

enum MutationSaveBookingResource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingResource, DocumentNode> = {
    [MutationSaveBookingResource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingResource}. */
type MutationSaveBookingResourceParams = MutateParams<MutationSaveBookingResource, MutateSaveBookingResourceRequest>

/** Creates or updates a booking resource. */
export const mutateSaveBookingResource = async ({
    mutation = MutationSaveBookingResource.Mutation1,
    request,
    signal,
}: MutationSaveBookingResourceParams): Promise<ApolloClient.MutateResult<SaveBookingResourceMutation>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SaveBookingResourceMutation, InputVariables<MutateSaveBookingResourceRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
