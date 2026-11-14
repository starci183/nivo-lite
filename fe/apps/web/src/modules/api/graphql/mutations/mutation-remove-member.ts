import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RemoveMemberMutation, RemoveMemberMutationVariables } from "../__generated__/graphql"

/** The input of the `removeMember` mutation. */
type MutateRemoveMemberRequest = WireInput<RemoveMemberMutationVariables["input"]>

/** The response of the `removeMember` mutation: the typed payload straight from the back end contract. */
type MutateRemoveMemberResponse = RemoveMemberMutation

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
}: MutateRemoveMemberParams): Promise<ApolloClient.MutateResult<MutateRemoveMemberResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
