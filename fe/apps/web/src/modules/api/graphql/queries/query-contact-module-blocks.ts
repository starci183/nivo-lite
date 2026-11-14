import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ContactModuleBlocksQuery, ContactModuleBlocksQueryVariables } from "../__generated__/graphql"

/** The response of the `contactModuleBlocks` query: the typed payload straight from the back end contract. */
type QueryContactModuleBlocksResponse = ContactModuleBlocksQuery

/** The input of the `contactModuleBlocks` query. */
type QueryContactModuleBlocksRequest = WireInput<ContactModuleBlocksQueryVariables["input"]>

type Document = TypedDocumentNode<QueryContactModuleBlocksResponse, InputVariables<QueryContactModuleBlocksRequest>>

const query1: Document = gql`
    query ContactModuleBlocks($input: ContactModuleBlocksInput!) {
        contactModuleBlocks(input: $input) {
            installationId
            agentId
            agentName
            moduleKey
            blocks {
                id
                title
                nodeJson
                dataJson
                count
                hasMore
            }
        }
    }
`

enum QueryContactModuleBlocks {
    Query1 = "query1",
}

const queryMap: Record<QueryContactModuleBlocks, Document> = { [QueryContactModuleBlocks.Query1]: query1 }

/** Apollo params for {@link queryContactModuleBlocks}. */
interface QueryContactModuleBlocksParams extends QueryParams<QueryContactModuleBlocks, QueryContactModuleBlocksRequest> {
    request: QueryContactModuleBlocksRequest
}

/**
 * Reads what each installed agent's module knows about one person: per agent the blocks its module mounts on the contact detail, with
 * the first rows its read gave for the person (the back end `contactModuleBlocks` query).
 */
export const queryContactModuleBlocks = async ({
    query = QueryContactModuleBlocks.Query1,
    request,
    signal,
}: QueryContactModuleBlocksParams): Promise<ApolloClient.QueryResult<QueryContactModuleBlocksResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
