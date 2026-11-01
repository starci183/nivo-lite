import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { BrainTodoQuery } from "../__generated__/graphql"

/** The response of the `brainTodo` query: the typed payload straight from the back end contract. */
type QueryBrainTodoResponse = BrainTodoQuery

type Document = TypedDocumentNode<QueryBrainTodoResponse, Record<string, never>>

const query1: Document = gql`
    query BrainTodo {
        brainTodo {
            findings
            facts
            questions
            total
        }
    }
`

enum QueryBrainTodo {
    Query1 = "query1",
}

const queryMap: Record<QueryBrainTodo, Document> = { [QueryBrainTodo.Query1]: query1 }

/** Calls the back end brainTodo query: three counts of what needs the owner in the Second Brain and their sum, never the lists. */
export const queryBrainTodo = async ({ query = QueryBrainTodo.Query1, signal }: QueryParams<QueryBrainTodo> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
