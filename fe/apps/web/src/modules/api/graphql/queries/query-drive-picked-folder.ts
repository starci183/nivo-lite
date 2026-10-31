import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { DrivePickedFolderQuery, DrivePickedFolderQueryVariables } from "../__generated__/graphql"

/** The variables of the `drivePickedFolder` query. */
export type QueryDrivePickedFolderRequest = WireInput<DrivePickedFolderQueryVariables["input"]>

/** The response of the `drivePickedFolder` query: the typed payload straight from the back end contract. */
type QueryDrivePickedFolderResponse = DrivePickedFolderQuery

const query1: TypedDocumentNode<QueryDrivePickedFolderResponse, InputVariables<QueryDrivePickedFolderRequest>> = gql`
    query DrivePickedFolder($input: DrivePickedFolderInput!) {
        drivePickedFolder(input: $input) {
            empty
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

enum QueryDrivePickedFolder {
    Query1 = "query1",
}

const queryMap: Record<QueryDrivePickedFolder, TypedDocumentNode<QueryDrivePickedFolderResponse, InputVariables<QueryDrivePickedFolderRequest>>> = {
    [QueryDrivePickedFolder.Query1]: query1,
}

/** Apollo params for {@link queryDrivePickedFolder}. */
interface QueryDrivePickedFolderParams extends QueryParams<QueryDrivePickedFolder, QueryDrivePickedFolderRequest> {
    request: QueryDrivePickedFolderRequest
}

/** Lists the files of a folder the owner picked in Google Picker with a browser token, used once and never stored. Rejects with the back end failure. */
export const queryDrivePickedFolder = async ({ query = QueryDrivePickedFolder.Query1, request, signal }: QueryDrivePickedFolderParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
