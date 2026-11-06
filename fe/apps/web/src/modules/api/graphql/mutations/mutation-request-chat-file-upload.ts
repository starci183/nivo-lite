import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestChatFileUploadMutation, RequestChatFileUploadMutationVariables } from "../__generated__/graphql"

/** Generated input of the RequestChatFileUpload mutation. */
export type MutateRequestChatFileUploadRequest = WireInput<RequestChatFileUploadMutationVariables["input"]>

type MutateRequestChatFileUploadResponse = RequestChatFileUploadMutation

type Document = TypedDocumentNode<MutateRequestChatFileUploadResponse, InputVariables<MutateRequestChatFileUploadRequest>>

const mutation1: Document = gql`
    mutation RequestChatFileUpload($input: RequestChatFileUploadInput!) {
        requestChatFileUpload(input: $input) {
            upload {
                fileKey
                uploadUrl
                method
                headers {
                    name
                    value
                }
                expiresAt
            }
            refusal
        }
    }
`

enum MutationRequestChatFileUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestChatFileUpload, Document> = { [MutationRequestChatFileUpload.Mutation1]: mutation1 }

/** Parameters of the RequestChatFileUpload mutation. */
type MutateRequestChatFileUploadParams = MutateParams<MutationRequestChatFileUpload, MutateRequestChatFileUploadRequest>

/** Asks for the address a file of a room is uploaded to; the file key it answers goes in the next message. */
export const mutateRequestChatFileUpload = async ({
    mutation = MutationRequestChatFileUpload.Mutation1,
    request,
    signal,
    headers,
}: MutateRequestChatFileUploadParams): Promise<ApolloClient.MutateResult<MutateRequestChatFileUploadResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
