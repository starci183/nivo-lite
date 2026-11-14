import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BrainTodoQuery } from "../__generated__/graphql"

/** The response of the `brainTodo` query: the typed payload straight from the back end contract. */
type QueryBrainTodoResponse = BrainTodoQuery

type Document = TypedDocumentNode<QueryBrainTodoResponse, Record<string, never>>

const query1: Document = gql`
    query BrainTodo {
        brainTodo {
            facts
            questions
            proposals
            total
        }
    }
`

enum QueryBrainTodo {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainTodo, Document> = { [QueryBrainTodo.Query1]: query1 }

/** Calls the back end brainTodo query: three counts of what needs the owner in the Second Brain and their sum, never the lists. */
export const queryBrainTodo = async ({
    query = QueryBrainTodo.Query1,
    signal,
}: QueryParams<QueryBrainTodo> = {}): Promise<ApolloClient.QueryResult<QueryBrainTodoResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
