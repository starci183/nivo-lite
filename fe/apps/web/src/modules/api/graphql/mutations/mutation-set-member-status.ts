import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetMemberStatusArgs } from "../__generated__/schema"

/** The input of the `setMemberStatus` mutation. */
type MutateSetMemberStatusRequest = MutationSetMemberStatusArgs["input"]

/** The response of the `setMemberStatus` mutation: the typed payload straight from the back end contract. */
type MutateSetMemberStatusResponse = Pick<Mutation, "setMemberStatus">

type Document = TypedDocumentNode<MutateSetMemberStatusResponse, InputVariables<MutateSetMemberStatusRequest>>

const mutation1: Document = gql`
    mutation SetMemberStatus($input: SetMemberStatusInput!) {
        setMemberStatus(input: $input)
    }
`

enum MutationSetMemberStatus {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetMemberStatus, Document> = {
    [MutationSetMemberStatus.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetMemberStatus}. */
type MutateSetMemberStatusParams = MutateParams<MutationSetMemberStatus, MutateSetMemberStatusRequest>

/** Enables or disables a member (the back end `setMemberStatus` mutation). */
export const mutateSetMemberStatus = async ({
    mutation = MutationSetMemberStatus.Mutation1,
    request,
    signal,
}: MutateSetMemberStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
