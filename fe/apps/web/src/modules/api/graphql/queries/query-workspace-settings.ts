import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkspaceSettingsQuery } from "../__generated__/graphql"

/** The response of the `workspaceSettings` query: the typed payload straight from the back end contract. */
type QueryWorkspaceSettingsResponse = WorkspaceSettingsQuery

type Document = TypedDocumentNode<QueryWorkspaceSettingsResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceSettings {
        workspaceSettings {
            logoUrl
            name
            timeZone
        }
    }
`

enum QueryWorkspaceSettings {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceSettings, Document> = {
    [QueryWorkspaceSettings.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceSettings}. */
type QueryWorkspaceSettingsParams = QueryParams<QueryWorkspaceSettings>

/** The open workspace's name, time zone and logo (the back end `workspaceSettings` query, any member). Rejects with the back end failure. */
export const queryWorkspaceSettings = async ({
    query = QueryWorkspaceSettings.Query1,
    signal,
}: QueryWorkspaceSettingsParams = {}): Promise<ApolloClient.QueryResult<QueryWorkspaceSettingsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
