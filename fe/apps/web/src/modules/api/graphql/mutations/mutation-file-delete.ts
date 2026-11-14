import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type GraphQLOperationContext, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { FileDeleteMutation, FileDeleteMutationVariables } from "../__generated__/graphql"

/** The `WorkbenchFileDeleteInput` of the door as a caller builds it. */
type FileDeleteInput = WireInput<FileDeleteMutationVariables["input"]>

/**
 * Clears the file a record holds in one field (or removes one file of a list field, named by `key`) and its object, made for the
 * action `via`.
 */
const mutation1: TypedDocumentNode<FileDeleteMutation, FileDeleteMutationVariables> = gql`
    mutation FileDelete($input: WorkbenchFileDeleteInput!) {
        fileDelete(input: $input) {
            data
        }
    }
`

/** Parameters of {@link mutateFileDelete}. */
type MutateFileDeleteParams = GraphQLOperationContext & FileDeleteInput

/** Removes one file through the door and answers it as the back end sent it. */
export const mutateFileDelete = async ({
    signal,
    ...input
}: MutateFileDeleteParams): Promise<ApolloClient.MutateResult<FileDeleteMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutation1, variables: { input: { ...input, key: input.key ?? null } } })
}
