import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestMyAvatarUploadMutation, RequestMyAvatarUploadMutationVariables } from "../__generated__/graphql"

/** The input of the `requestMyAvatarUpload` mutation. */
export type MutateRequestMyAvatarUploadRequest = WireInput<RequestMyAvatarUploadMutationVariables["input"]>

type MutateRequestMyAvatarUploadResponse = RequestMyAvatarUploadMutation

type Document = TypedDocumentNode<
    MutateRequestMyAvatarUploadResponse,
    InputVariables<MutateRequestMyAvatarUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestMyAvatarUpload($input: RequestMyAvatarUploadInput!) {
        requestMyAvatarUpload(input: $input) {
            path
            publicUrl
            signedUrl
            token
        }
    }
`

enum MutationRequestMyAvatarUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestMyAvatarUpload, Document> = {
    [MutationRequestMyAvatarUpload.Mutation1]: mutation1,
}

/** The back end `requestMyAvatarUpload` mutation: a one-time address to PUT the caller's own picture to. */
export const mutateRequestMyAvatarUpload = async ({
    mutation = MutationRequestMyAvatarUpload.Mutation1,
    request,
    signal,
}: MutateParams<MutationRequestMyAvatarUpload, MutateRequestMyAvatarUploadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
