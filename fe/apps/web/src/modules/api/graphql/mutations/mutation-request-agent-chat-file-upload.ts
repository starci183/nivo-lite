import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestAgentChatFileUploadMutation,
    RequestAgentChatFileUploadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `requestAgentChatFileUpload` mutation. */
export type MutateRequestAgentChatFileUploadRequest = WireInput<RequestAgentChatFileUploadMutationVariables["input"]>

/** The generated payload of the `requestAgentChatFileUpload` mutation. */
type MutateRequestAgentChatFileUploadResponse = RequestAgentChatFileUploadMutation

type Document = TypedDocumentNode<
    MutateRequestAgentChatFileUploadResponse,
    InputVariables<MutateRequestAgentChatFileUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestAgentChatFileUpload($input: RequestAgentChatFileUploadInput!) {
        requestAgentChatFileUpload(input: $input) {
            path
            signedUrl
        }
    }
`

enum MutationRequestAgentChatFileUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestAgentChatFileUpload, Document> = {
    [MutationRequestAgentChatFileUpload.Mutation1]: mutation1,
}

/** Apollo options for the `requestAgentChatFileUpload` mutation. */
type MutateRequestAgentChatFileUploadParams = MutateParams<
    MutationRequestAgentChatFileUpload,
    MutateRequestAgentChatFileUploadRequest
> & {
    request: MutateRequestAgentChatFileUploadRequest
}

/** Runs `requestAgentChatFileUpload` through the authenticated back end GraphQL API. */
export const mutateRequestAgentChatFileUpload = async ({
    mutation = MutationRequestAgentChatFileUpload.Mutation1,
    request,
    signal,
}: MutateRequestAgentChatFileUploadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
