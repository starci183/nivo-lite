import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DriveLinkedFolderQuery, DriveLinkedFolderQueryVariables } from "../__generated__/graphql"

/** The variables of the `driveLinkedFolder` query. */
export type QueryDriveLinkedFolderRequest = WireInput<DriveLinkedFolderQueryVariables["input"]>

/** The response of the `driveLinkedFolder` query: the typed payload straight from the back end contract. */
type QueryDriveLinkedFolderResponse = DriveLinkedFolderQuery

const query1: TypedDocumentNode<QueryDriveLinkedFolderResponse, InputVariables<QueryDriveLinkedFolderRequest>> = gql`
    query DriveLinkedFolder($input: DriveLinkedFolderInput!) {
        driveLinkedFolder(input: $input) {
            files {
                id
                mimeType
                modifiedTime
                name
                path
                size
                url
            }
            name
            truncated
        }
    }
`

enum QueryDriveLinkedFolder {
    Query1 = "query1",
}

const queryMap: Record<
    QueryDriveLinkedFolder,
    TypedDocumentNode<QueryDriveLinkedFolderResponse, InputVariables<QueryDriveLinkedFolderRequest>>
> = {
    [QueryDriveLinkedFolder.Query1]: query1,
}

/** Apollo params for {@link queryDriveLinkedFolder}. */
interface QueryDriveLinkedFolderParams extends QueryParams<QueryDriveLinkedFolder, QueryDriveLinkedFolderRequest> {
    request: QueryDriveLinkedFolderRequest
}

/** Lists the files of a Google Drive folder the workspace grant can read (three levels, at most 300 files). Rejects with the back end failure. */
export const queryDriveLinkedFolder = async ({
    query = QueryDriveLinkedFolder.Query1,
    request,
    signal,
}: QueryDriveLinkedFolderParams): Promise<ApolloClient.QueryResult<QueryDriveLinkedFolderResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
