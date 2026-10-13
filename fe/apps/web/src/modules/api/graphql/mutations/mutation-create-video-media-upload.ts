import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateVideoMediaUploadMutation, CreateVideoMediaUploadMutationVariables } from "../__generated__/graphql"

/** The input of the `createVideoMediaUpload` mutation. */
type MutateCreateVideoMediaUploadRequest = WireInput<CreateVideoMediaUploadMutationVariables["input"]>

/** The generated payload of the `createVideoMediaUpload` mutation. */
type MutateCreateVideoMediaUploadResponse = CreateVideoMediaUploadMutation

type Document = TypedDocumentNode<
    MutateCreateVideoMediaUploadResponse,
    InputVariables<MutateCreateVideoMediaUploadRequest>
>

const mutation1: Document = gql`
    mutation CreateVideoMediaUpload($input: CreateVideoMediaUploadInput!) {
        createVideoMediaUpload(input: $input) {
            path
            signedUrl
            token
        }
    }
`

enum MutationCreateVideoMediaUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateVideoMediaUpload, Document> = {
    [MutationCreateVideoMediaUpload.Mutation1]: mutation1,
}

/** Apollo options for the `createVideoMediaUpload` mutation. */
type MutateCreateVideoMediaUploadParams = MutateParams<
    MutationCreateVideoMediaUpload,
    MutateCreateVideoMediaUploadRequest
>

/** Calls `createVideoMediaUpload` through the authenticated back end GraphQL API. */
export const mutateCreateVideoMediaUpload = async ({
    mutation = MutationCreateVideoMediaUpload.Mutation1,
    request,
    signal,
}: MutateCreateVideoMediaUploadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
