import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationLinkHiringStaffArgs } from "../__generated__/schema"

/** The input of the `linkHiringStaff` mutation. */
export type MutateLinkHiringStaffRequest = MutationLinkHiringStaffArgs["input"]

/** The response of the `linkHiringStaff` mutation. */
type MutateLinkHiringStaffResponse = Pick<Mutation, "linkHiringStaff">

const mutation1: TypedDocumentNode<MutateLinkHiringStaffResponse, InputVariables<MutateLinkHiringStaffRequest>> = gql`
    mutation LinkHiringStaff($input: HiringCandidateRefInput!) {
        linkHiringStaff(input: $input) {
            staffId
        }
    }
`

enum MutationLinkHiringStaff {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationLinkHiringStaff,
    TypedDocumentNode<MutateLinkHiringStaffResponse, InputVariables<MutateLinkHiringStaffRequest>>
> = {
    [MutationLinkHiringStaff.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateLinkHiringStaff}. */
type MutateLinkHiringStaffParams = MutateParams<MutationLinkHiringStaff, MutateLinkHiringStaffRequest>

/** Runs the `linkHiringStaff` mutation. */
export const mutateLinkHiringStaff = async ({
    mutation = MutationLinkHiringStaff.Mutation1,
    request,
    signal,
}: MutateLinkHiringStaffParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
