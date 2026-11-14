import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type GraphQLOperationContext, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { FileUrlQuery, FileUrlQueryVariables } from "../__generated__/graphql"

/** The `WorkbenchFileUrlInput` of the door as a caller builds it. */
type FileUrlInput = WireInput<FileUrlQueryVariables["input"]>

/**
 * A short-lived signed address that reads the file a record holds in one field (or one file of a list field, named by `key`), made
 * for the read or action `via`.
 */
const query1: TypedDocumentNode<FileUrlQuery, FileUrlQueryVariables> = gql`
    query FileUrl($input: WorkbenchFileUrlInput!) {
        fileUrl(input: $input) {
            data
        }
    }
`

/** Parameters of {@link queryFileUrl}. */
type QueryFileUrlParams = GraphQLOperationContext & FileUrlInput

/** Asks the door for the address of one file and answers it as the back end sent it; never cached, the address expires. */
export const queryFileUrl = async ({
    signal,
    ...input
}: QueryFileUrlParams): Promise<ApolloClient.QueryResult<FileUrlQuery>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: query1, variables: { input: { ...input, key: input.key ?? null } }, fetchPolicy: "no-cache" })
}
