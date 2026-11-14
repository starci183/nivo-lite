import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type GraphQLOperationContext, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { FileLinkMutation, FileLinkMutationVariables } from "../__generated__/graphql"

/** The `WorkbenchFileLinkInput` of the door as a caller builds it. */
type FileLinkInput = WireInput<FileLinkMutationVariables["input"]>

/**
 * The last step of a file upload: attaches the confirmed object to the record's field (a list field appends) and answers the
 * reference the record now holds. Made for the action `via`.
 */
const mutation1: TypedDocumentNode<FileLinkMutation, FileLinkMutationVariables> = gql`
    mutation FileLink($input: WorkbenchFileLinkInput!) {
        fileLink(input: $input) {
            data
        }
    }
`

/** Parameters of {@link mutateFileLink}. */
type MutateFileLinkParams = GraphQLOperationContext & FileLinkInput

/** Attaches one confirmed upload to the record through the door and answers it as the back end sent it. */
export const mutateFileLink = async ({
    signal,
    ...input
}: MutateFileLinkParams): Promise<ApolloClient.MutateResult<FileLinkMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutation1, variables: { input } })
}
