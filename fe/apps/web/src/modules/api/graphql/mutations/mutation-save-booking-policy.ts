import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingPolicyRequest, MutateSaveBookingPolicyResponse } from "./types/save-booking-policy"

const mutation1 = gql`
    mutation SaveBookingPolicy($input: SaveBookingPolicyInput!) {
        saveBookingPolicy(input: $input) {
            workspaceId
        }
    }
`

export enum MutationSaveBookingPolicy {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingPolicy, DocumentNode> = {
    [MutationSaveBookingPolicy.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingPolicy}. */
export type MutationSaveBookingPolicyParams = MutateParams<MutationSaveBookingPolicy, MutateSaveBookingPolicyRequest>

/** Saves the cancellation, deposit and slot rules of the workspace. */
export const mutateSaveBookingPolicy = async ({ mutation = MutationSaveBookingPolicy.Mutation1, request, signal }: MutationSaveBookingPolicyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateSaveBookingPolicyResponse, InputVariables<MutateSaveBookingPolicyRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
