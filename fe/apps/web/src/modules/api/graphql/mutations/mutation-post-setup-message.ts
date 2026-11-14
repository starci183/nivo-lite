import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PostSetupMessageMutation, PostSetupMessageMutationVariables } from "../__generated__/graphql"

/** The input of the `postSetupMessage` mutation. */
export type MutatePostSetupMessageRequest = WireInput<PostSetupMessageMutationVariables["input"]>

type MutatePostSetupMessageResponse = PostSetupMessageMutation

const mutation1: TypedDocumentNode<MutatePostSetupMessageResponse, InputVariables<MutatePostSetupMessageRequest>> = gql`
    mutation PostSetupMessage($input: PostSetupMessageInput!) {
        postSetupMessage(input: $input) {
            author
            body
            createdAt
            id
            role
            setupSessionId
        }
    }
`

enum MutationPostSetupMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationPostSetupMessage,
    TypedDocumentNode<MutatePostSetupMessageResponse, InputVariables<MutatePostSetupMessageRequest>>
> = {
    [MutationPostSetupMessage.Mutation1]: mutation1,
}

/** The back end `postSetupMessage` mutation. */
export const mutatePostSetupMessage = async ({
    mutation = MutationPostSetupMessage.Mutation1,
    request,
    signal,
}: MutateParams<MutationPostSetupMessage, MutatePostSetupMessageRequest>): Promise<
    ApolloClient.MutateResult<MutatePostSetupMessageResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
