import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type GraphQLOperationContext, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { FileUploadMutation, FileUploadMutationVariables } from "../__generated__/graphql"

/** The `WorkbenchFileUploadInput` of the door as a caller builds it. */
type FileUploadInput = WireInput<FileUploadMutationVariables["input"]>

/**
 * The first step of a file upload through the back end door: a ticket (a presigned PUT) for one file of a declared `file` field of a
 * record, made for the action `via`.
 */
const mutation1: TypedDocumentNode<FileUploadMutation, FileUploadMutationVariables> = gql`
    mutation FileUpload($input: WorkbenchFileUploadInput!) {
        fileUpload(input: $input) {
            data
        }
    }
`

/** Parameters of {@link mutateFileUpload}. */
type MutateFileUploadParams = GraphQLOperationContext & FileUploadInput

/** Asks the door for the ticket of one upload and answers it as the back end sent it. */
export const mutateFileUpload = async ({
    signal,
    ...input
}: MutateFileUploadParams): Promise<ApolloClient.MutateResult<FileUploadMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutation1, variables: { input } })
}
