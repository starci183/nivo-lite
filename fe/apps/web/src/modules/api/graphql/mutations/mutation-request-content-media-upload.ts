import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestContentMediaUploadMutation,
    RequestContentMediaUploadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `requestContentMediaUpload` mutation. */
type MutateRequestContentMediaUploadRequest = WireInput<RequestContentMediaUploadMutationVariables["input"]>

/** The generated payload of the `requestContentMediaUpload` mutation. */
type MutateRequestContentMediaUploadResponse = RequestContentMediaUploadMutation

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
