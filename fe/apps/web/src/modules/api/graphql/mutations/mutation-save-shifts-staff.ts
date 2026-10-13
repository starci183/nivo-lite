import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveShiftsStaffArgs } from "../__generated__/schema"

/** The input of the `saveShiftsStaff` mutation. */
export type MutateSaveShiftsStaffRequest = MutationSaveShiftsStaffArgs["input"]

/** The response of the `saveShiftsStaff` mutation. */
type MutateSaveShiftsStaffResponse = Pick<Mutation, "saveShiftsStaff">

const mutation1: TypedDocumentNode<MutateSaveShiftsStaffResponse, InputVariables<MutateSaveShiftsStaffRequest>> = gql`
    mutation SaveShiftsStaff($input: SaveShiftsStaffInput!) {
        saveShiftsStaff(input: $input) {
            id
        }
    }
`

enum MutationSaveShiftsStaff {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveShiftsStaff,
    TypedDocumentNode<MutateSaveShiftsStaffResponse, InputVariables<MutateSaveShiftsStaffRequest>>
> = {
    [MutationSaveShiftsStaff.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveShiftsStaff}. */
type MutateSaveShiftsStaffParams = MutateParams<MutationSaveShiftsStaff, MutateSaveShiftsStaffRequest>

/** Runs the `saveShiftsStaff` mutation. */
export const mutateSaveShiftsStaff = async ({
    mutation = MutationSaveShiftsStaff.Mutation1,
    request,
    signal,
}: MutateSaveShiftsStaffParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
