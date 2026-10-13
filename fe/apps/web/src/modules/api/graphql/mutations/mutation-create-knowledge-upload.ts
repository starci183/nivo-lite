import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCreateKnowledgeUploadArgs } from "../__generated__/schema"

/** The response of the `createKnowledgeUpload` mutation: the typed payload straight from the back end contract. */
type MutateCreateKnowledgeUploadResponse = Pick<Mutation, "createKnowledgeUpload">

/** The input of the `createKnowledgeUpload` mutation. */
export type MutateCreateKnowledgeUploadRequest = MutationCreateKnowledgeUploadArgs["input"]

const mutation1: TypedDocumentNode<
    MutateCreateKnowledgeUploadResponse,
    InputVariables<MutateCreateKnowledgeUploadRequest>
> = gql`
    mutation CreateKnowledgeUpload($input: CreateKnowledgeUploadInput!) {
        createKnowledgeUpload(input: $input) {
            path
            signedUrl
            token
        }
    }
`

enum MutationCreateKnowledgeUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateKnowledgeUpload,
    TypedDocumentNode<MutateCreateKnowledgeUploadResponse, InputVariables<MutateCreateKnowledgeUploadRequest>>
> = {
    [MutationCreateKnowledgeUpload.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateKnowledgeUpload}. */
type MutateCreateKnowledgeUploadParams = MutateParams<MutationCreateKnowledgeUpload, MutateCreateKnowledgeUploadRequest>

/**
 * Asks the back end for the presigned address one document upload goes to; the bytes then travel straight to the storage
 * URL (the back end `createKnowledgeUpload` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`,
 * message localized by the server).
 */
export const mutateCreateKnowledgeUpload = async ({
    mutation = MutationCreateKnowledgeUpload.Mutation1,
    request,
    signal,
}: MutateCreateKnowledgeUploadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
