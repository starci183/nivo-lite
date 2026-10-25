import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestAgentAvatarUploadMutation,
    RequestAgentAvatarUploadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `requestAgentAvatarUpload` mutation. */
export type MutateRequestAgentAvatarUploadRequest = WireInput<RequestAgentAvatarUploadMutationVariables["input"]>

type MutateRequestAgentAvatarUploadResponse = RequestAgentAvatarUploadMutation

type Document = TypedDocumentNode<
    MutateRequestAgentAvatarUploadResponse,
    InputVariables<MutateRequestAgentAvatarUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestAgentAvatarUpload($input: RequestAgentAvatarUploadInput!) {
        requestAgentAvatarUpload(input: $input) {
            path
            publicUrl
            signedUrl
            token
        }
    }
`

enum MutationRequestAgentAvatarUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestAgentAvatarUpload, Document> = {
    [MutationRequestAgentAvatarUpload.Mutation1]: mutation1,
}

/** The back end `requestAgentAvatarUpload` mutation: a one-time address to PUT an agent picture to. */
export const mutateRequestAgentAvatarUpload = async ({
    mutation = MutationRequestAgentAvatarUpload.Mutation1,
    request,
    signal,
}: MutateParams<MutationRequestAgentAvatarUpload, MutateRequestAgentAvatarUploadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
