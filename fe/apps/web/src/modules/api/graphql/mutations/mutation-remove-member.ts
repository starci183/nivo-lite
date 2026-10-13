import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRemoveMemberArgs } from "../__generated__/schema"

/** The input of the `removeMember` mutation. */
type MutateRemoveMemberRequest = MutationRemoveMemberArgs["input"]

/** The response of the `removeMember` mutation: the typed payload straight from the back end contract. */
type MutateRemoveMemberResponse = Pick<Mutation, "removeMember">

type Document = TypedDocumentNode<MutateRemoveMemberResponse, InputVariables<MutateRemoveMemberRequest>>

const mutation1: Document = gql`
    mutation RemoveMember($input: MemberRefInput!) {
        removeMember(input: $input)
    }
`

enum MutationRemoveMember {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveMember, Document> = {
    [MutationRemoveMember.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveMember}. */
type MutateRemoveMemberParams = MutateParams<MutationRemoveMember, MutateRemoveMemberRequest>

/** Removes a member from the active workspace (the back end `removeMember` mutation). */
export const mutateRemoveMember = async ({
    mutation = MutationRemoveMember.Mutation1,
    request,
    signal,
}: MutateRemoveMemberParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
