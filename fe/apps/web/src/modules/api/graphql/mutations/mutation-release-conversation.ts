import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ReleaseConversationMutation, ReleaseConversationMutationVariables } from "../__generated__/graphql"

/** The input of the `releaseConversation` mutation. */
export type MutateReleaseConversationRequest = WireInput<ReleaseConversationMutationVariables["input"]>

type MutateReleaseConversationResponse = ReleaseConversationMutation

type Document = TypedDocumentNode<MutateReleaseConversationResponse, InputVariables<MutateReleaseConversationRequest>>

const mutation1: Document = gql`
    mutation ReleaseConversation($input: ReleaseConversationInput!) {
        releaseConversation(input: $input) {
            outcome
            answered
        }
    }
`

enum MutationReleaseConversation {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationReleaseConversation, Document> = { [MutationReleaseConversation.Mutation1]: mutation1 }

/** The back end `releaseConversation` mutation: hands the customer's route back to the agent (clears the staff hold of the caller). */
export const mutateReleaseConversation = async ({
    mutation = MutationReleaseConversation.Mutation1,
    request,
    signal,
    headers,
}: MutateParams<MutationReleaseConversation, MutateReleaseConversationRequest>): Promise<
    ApolloClient.MutateResult<MutateReleaseConversationResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request }, context: { headers } })
}
