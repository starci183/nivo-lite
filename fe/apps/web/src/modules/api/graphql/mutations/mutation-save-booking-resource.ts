import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingResourceRequest, MutateSaveBookingResourceResponse } from "./types/save-booking-resource"

const mutation1 = gql`
    mutation SaveBookingResource($input: SaveBookingResourceInput!) {
        saveBookingResource(input: $input) {
            id
        }
    }
`

export enum MutationSaveBookingResource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingResource, DocumentNode> = {
    [MutationSaveBookingResource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingResource}. */
export type MutationSaveBookingResourceParams = MutateParams<MutationSaveBookingResource, MutateSaveBookingResourceRequest>

/** Creates or updates a booking resource. */
export const mutateSaveBookingResource = async ({ mutation = MutationSaveBookingResource.Mutation1, request, signal }: MutationSaveBookingResourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateSaveBookingResourceResponse, InputVariables<MutateSaveBookingResourceRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
