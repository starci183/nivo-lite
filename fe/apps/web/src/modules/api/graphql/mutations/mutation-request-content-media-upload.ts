import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestContentMediaUploadArgs } from "../__generated__/schema"

/** The input of the `requestContentMediaUpload` mutation. */
type MutateRequestContentMediaUploadRequest = MutationRequestContentMediaUploadArgs["input"]

/** The generated payload of the `requestContentMediaUpload` mutation. */
type MutateRequestContentMediaUploadResponse = Pick<Mutation, "requestContentMediaUpload">

type Document = TypedDocumentNode<
    MutateRequestContentMediaUploadResponse,
    InputVariables<MutateRequestContentMediaUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestContentMediaUpload($input: RequestContentMediaUploadInput!) {
        requestContentMediaUpload(input: $input) {
            name
            path
            signedUrl
            token
        }
    }
`

enum MutationRequestContentMediaUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestContentMediaUpload, Document> = {
    [MutationRequestContentMediaUpload.Mutation1]: mutation1,
}

/** Apollo options for the `requestContentMediaUpload` mutation. */
type MutateRequestContentMediaUploadParams = MutateParams<
    MutationRequestContentMediaUpload,
    MutateRequestContentMediaUploadRequest
> & {
    request: MutateRequestContentMediaUploadRequest
}

/** Runs `requestContentMediaUpload` through the authenticated back end GraphQL API. */
export const mutateRequestContentMediaUpload = async ({
    mutation = MutationRequestContentMediaUpload.Mutation1,
    request,
    signal,
}: MutateRequestContentMediaUploadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
