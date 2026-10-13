import type { RemoveBookingResourceMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRemoveBookingResourceRequest } from "./types/remove-booking-resource"

const mutation1 = gql`
    mutation RemoveBookingResource($input: RemoveBookingResourceInput!) {
        removeBookingResource(input: $input) {
            id
        }
    }
`

enum MutationRemoveBookingResource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveBookingResource, DocumentNode> = {
    [MutationRemoveBookingResource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveBookingResource}. */
type MutationRemoveBookingResourceParams = MutateParams<
    MutationRemoveBookingResource,
    MutateRemoveBookingResourceRequest
>

/** Removes a booking resource. */
export const mutateRemoveBookingResource = async ({
    mutation = MutationRemoveBookingResource.Mutation1,
    request,
    signal,
}: MutationRemoveBookingResourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<RemoveBookingResourceMutation, InputVariables<MutateRemoveBookingResourceRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
