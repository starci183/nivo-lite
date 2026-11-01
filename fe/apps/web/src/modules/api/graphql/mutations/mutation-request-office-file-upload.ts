import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestOfficeFileUploadMutation,
    RequestOfficeFileUploadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `requestOfficeFileUpload` mutation. */
type MutateRequestOfficeFileUploadRequest = WireInput<RequestOfficeFileUploadMutationVariables["input"]>

/** The generated payload of the `requestOfficeFileUpload` mutation. */
type MutateRequestOfficeFileUploadResponse = RequestOfficeFileUploadMutation

type Document = TypedDocumentNode<
    MutateRequestOfficeFileUploadResponse,
    InputVariables<MutateRequestOfficeFileUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestOfficeFileUpload($input: RequestOfficeFileUploadInput!) {
        requestOfficeFileUpload(input: $input) {
            path
            signedUrl
        }
    }
`

enum MutationRequestOfficeFileUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestOfficeFileUpload, Document> = {
    [MutationRequestOfficeFileUpload.Mutation1]: mutation1,
}

/** Apollo options for the `requestOfficeFileUpload` mutation. */
type MutateRequestOfficeFileUploadParams = MutateParams<
    MutationRequestOfficeFileUpload,
    MutateRequestOfficeFileUploadRequest
> & {
    request: MutateRequestOfficeFileUploadRequest
}

/** Runs `requestOfficeFileUpload` through the authenticated back end GraphQL API. */
export const mutateRequestOfficeFileUpload = async ({
    mutation = MutationRequestOfficeFileUpload.Mutation1,
    request,
    signal,
}: MutateRequestOfficeFileUploadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
