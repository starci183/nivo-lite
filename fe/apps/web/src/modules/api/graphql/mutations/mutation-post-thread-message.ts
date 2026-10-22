import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { PostThreadMessageMutation, PostThreadMessageMutationVariables } from "../__generated__/graphql"

/** The input of the `postThreadMessage` mutation. */
export type MutatePostThreadMessageRequest = WireInput<PostThreadMessageMutationVariables["input"]>

type MutatePostThreadMessageResponse = PostThreadMessageMutation

const mutation1: TypedDocumentNode<
    MutatePostThreadMessageResponse,
    InputVariables<MutatePostThreadMessageRequest>
> = gql`
    mutation PostThreadMessage($input: PostThreadMessageInput!) {
        postThreadMessage(input: $input) {
            id
            threadId
            authorKind
            authorId
            authorName
            authorRole
            body
            quoted
            mentions {
                kind
                id
                name
            }
            approval {
                requestId
                action
                amount
                unit
                rule
                policy
                expiresAt
                outcome
                decidedBy
                decidedByName
                decidedAt
                approvers {
                    memberId
                    name
                    role
                    roomId
                    status
                }
                excluded {
                    memberId
                    name
                    reason
                }
                owner {
                    kind
                    id
                    name
                }
            }
            createdAt
        }
    }
`

enum MutationPostThreadMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationPostThreadMessage,
    TypedDocumentNode<MutatePostThreadMessageResponse, InputVariables<MutatePostThreadMessageRequest>>
> = {
    [MutationPostThreadMessage.Mutation1]: mutation1,
}

/** The back end `postThreadMessage` mutation: writes a message with the tags the member chose. */
export const mutatePostThreadMessage = async ({
    mutation = MutationPostThreadMessage.Mutation1,
    request,
    signal,
}: MutateParams<MutationPostThreadMessage, MutatePostThreadMessageRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
