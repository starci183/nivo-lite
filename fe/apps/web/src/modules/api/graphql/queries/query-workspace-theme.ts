import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkspaceThemeQuery } from "../__generated__/graphql"

/** The response of the `workspaceTheme` query: the typed payload straight from the back end contract. */
type QueryWorkspaceThemeResponse = WorkspaceThemeQuery

type Document = TypedDocumentNode<QueryWorkspaceThemeResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceTheme {
        workspaceTheme {
            base
            chroma
            font
            hue
            lightness
            mode
            radius
        }
    }
`

enum QueryWorkspaceTheme {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceTheme, Document> = {
    [QueryWorkspaceTheme.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceTheme}. */
type QueryWorkspaceThemeParams = QueryParams<QueryWorkspaceTheme>

/** The open workspace's brand theme (the back end `workspaceTheme` query, any member); null while it wears the NIVO default. Rejects with the back end failure. */
export const queryWorkspaceTheme = async ({
    query = QueryWorkspaceTheme.Query1,
    signal,
}: QueryWorkspaceThemeParams = {}): Promise<ApolloClient.QueryResult<QueryWorkspaceThemeResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
