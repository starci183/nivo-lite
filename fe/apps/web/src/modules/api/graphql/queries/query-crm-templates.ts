import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CrmTemplatesQuery } from "../__generated__/graphql"

/** The response of the `crmTemplates` query: the typed payload straight from the back end contract. */
type QueryCrmTemplatesResponse = CrmTemplatesQuery

const query1: TypedDocumentNode<QueryCrmTemplatesResponse> = gql`
    query CrmTemplates {
        crmTemplates {
            id
            label {
                vi
                en
            }
            authType
            authName
            swaggerPath
            baseUrlHint
            docs
            neededCount
        }
    }
`

enum QueryCrmTemplates {
    Query1 = "query1",
}

const queryMap: Record<QueryCrmTemplates, TypedDocumentNode<QueryCrmTemplatesResponse>> = {
    [QueryCrmTemplates.Query1]: query1,
}

/** Apollo params for {@link queryCrmTemplates}. */
type QueryCrmTemplatesParams = QueryParams<QueryCrmTemplates>

/** The CRMs the installed packages declare, for the connect wizard. Rejects with the back end failure. */
export const queryCrmTemplates = async ({
    query = QueryCrmTemplates.Query1,
    signal,
}: QueryCrmTemplatesParams = {}): Promise<ApolloClient.QueryResult<QueryCrmTemplatesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
