import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type GraphQLOperationContext, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { FileConfirmMutation, FileConfirmMutationVariables } from "../__generated__/graphql"

/** The `WorkbenchFileConfirmInput` of the door as a caller builds it. */
type FileConfirmInput = WireInput<FileConfirmMutationVariables["input"]>

/**
 * The second step of a file upload: the door proves the object the browser PUT and answers its reference (nothing is written to the
 * record yet). Made for the action `via`.
 */
const mutation1: TypedDocumentNode<FileConfirmMutation, FileConfirmMutationVariables> = gql`
    mutation FileConfirm($input: WorkbenchFileConfirmInput!) {
        fileConfirm(input: $input) {
            data
        }
    }
`

/** Parameters of {@link mutateFileConfirm}. */
type MutateFileConfirmParams = GraphQLOperationContext & FileConfirmInput

/** Runs the confirm step of one upload through the door and answers it as the back end sent it. */
export const mutateFileConfirm = async ({
    signal,
    ...input
}: MutateFileConfirmParams): Promise<ApolloClient.MutateResult<FileConfirmMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutation1, variables: { input } })
}
