import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { JoinInviteMutation, JoinInviteMutationVariables } from "../__generated__/graphql"

/** The input of the `joinInvite` mutation. */
type MutateJoinInviteRequest = WireInput<JoinInviteMutationVariables["input"]>

/** The response of the `joinInvite` mutation: the typed payload straight from the back end contract. */
type MutateJoinInviteResponse = JoinInviteMutation

type Document = TypedDocumentNode<MutateJoinInviteResponse, InputVariables<MutateJoinInviteRequest>>

const mutation1: Document = gql`
    mutation JoinInvite($input: InviteRefInput!) {
        joinInvite(input: $input) {
            workspaceId
        }
    }
`

enum MutationJoinInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationJoinInvite, Document> = {
    [MutationJoinInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateJoinInvite}. */
type MutateJoinInviteParams = MutateParams<MutationJoinInvite, MutateJoinInviteRequest>

/** Accepts, by its id, an invitation addressed to the signed-in person (the back end `joinInvite` mutation). */
export const mutateJoinInvite = async ({
    mutation = MutationJoinInvite.Mutation1,
    request,
    signal,
}: MutateJoinInviteParams): Promise<ApolloClient.MutateResult<MutateJoinInviteResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
