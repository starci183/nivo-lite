import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WebsiteThemeQuery, WebsiteThemeQueryVariables } from "../__generated__/graphql"

/** The input of the `websiteTheme` query: the public key of the hosted page. */
type QueryWebsiteThemeRequest = WireInput<WebsiteThemeQueryVariables["input"]>

type QueryWebsiteThemeResponse = WebsiteThemeQuery

type Document = TypedDocumentNode<QueryWebsiteThemeResponse, InputVariables<QueryWebsiteThemeRequest>>

const query1: Document = gql`
    query WebsiteTheme($input: WebsiteThemeInput!) {
        websiteTheme(input: $input) {
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

enum QueryWebsiteTheme {
    Query1 = "query1",
}

const queryMap: Record<QueryWebsiteTheme, Document> = {
    [QueryWebsiteTheme.Query1]: query1,
}

/** Apollo params for {@link queryWebsiteTheme}. */
type QueryWebsiteThemeParams = QueryParams<QueryWebsiteTheme, QueryWebsiteThemeRequest> & {
    readonly request: QueryWebsiteThemeRequest
}

/** The theme parameters of the workspace behind a site key, for the hosted page of its website (anonymous: no sign-in, no workspace header). */
export const queryWebsiteTheme = async ({
    query = QueryWebsiteTheme.Query1,
    request,
    signal,
}: QueryWebsiteThemeParams): Promise<ApolloClient.QueryResult<QueryWebsiteThemeResponse>> => {
    const apollo = createNoAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
