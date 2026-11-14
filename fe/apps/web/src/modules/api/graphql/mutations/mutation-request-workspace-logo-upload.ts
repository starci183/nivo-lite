import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type {
    RequestWorkspaceLogoUploadMutation,
    RequestWorkspaceLogoUploadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `requestWorkspaceLogoUpload` mutation. */
export type MutateRequestWorkspaceLogoUploadRequest = WireInput<RequestWorkspaceLogoUploadMutationVariables["input"]>

type MutateRequestWorkspaceLogoUploadResponse = RequestWorkspaceLogoUploadMutation

type Document = TypedDocumentNode<
    MutateRequestWorkspaceLogoUploadResponse,
    InputVariables<MutateRequestWorkspaceLogoUploadRequest>
>

const mutation1: Document = gql`
    mutation RequestWorkspaceLogoUpload($input: RequestWorkspaceLogoUploadInput!) {
        requestWorkspaceLogoUpload(input: $input) {
            path
            publicUrl
            signedUrl
            token
        }
    }
`

enum MutationRequestWorkspaceLogoUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestWorkspaceLogoUpload, Document> = {
    [MutationRequestWorkspaceLogoUpload.Mutation1]: mutation1,
}

/** The back end `requestWorkspaceLogoUpload` mutation: a one-time address to PUT the workspace logo to (owner and manager). */
export const mutateRequestWorkspaceLogoUpload = async ({
    mutation = MutationRequestWorkspaceLogoUpload.Mutation1,
    request,
    signal,
}: MutateParams<MutationRequestWorkspaceLogoUpload, MutateRequestWorkspaceLogoUploadRequest>): Promise<
    ApolloClient.MutateResult<MutateRequestWorkspaceLogoUploadResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
