import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreateKnowledgeUploadMutation, CreateKnowledgeUploadMutationVariables } from "../__generated__/graphql"

/** The response of the `createKnowledgeUpload` mutation: the typed payload straight from the back end contract. */
type MutateCreateKnowledgeUploadResponse = CreateKnowledgeUploadMutation

/** The input of the `createKnowledgeUpload` mutation. */
export type MutateCreateKnowledgeUploadRequest = WireInput<CreateKnowledgeUploadMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateCreateKnowledgeUploadResponse,
    InputVariables<MutateCreateKnowledgeUploadRequest>
> = gql`
    mutation CreateKnowledgeUpload($input: CreateKnowledgeUploadInput!) {
        createKnowledgeUpload(input: $input) {
            contentType
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
}: MutateCreateKnowledgeUploadParams): Promise<ApolloClient.MutateResult<MutateCreateKnowledgeUploadResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
