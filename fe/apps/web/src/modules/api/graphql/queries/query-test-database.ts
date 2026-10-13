import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { TestDatabaseQuery, TestDatabaseQueryVariables } from "../__generated__/graphql"

/** The variables of the `testDatabase` query. */
type QueryTestDatabaseRequest = WireInput<TestDatabaseQueryVariables["input"]>

/** The response of the `testDatabase` query. */
type QueryTestDatabaseResponse = TestDatabaseQuery

const query1: TypedDocumentNode<QueryTestDatabaseResponse, InputVariables<QueryTestDatabaseRequest>> = gql`
    query TestDatabase($input: TestDatabaseInput!) {
        testDatabase(input: $input) {
            schema
            name
            columns {
                name
                type
            }
        }
    }
`

enum QueryTestDatabase {
    Query1 = "query1",
}

const queryMap: Record<
    QueryTestDatabase,
    TypedDocumentNode<QueryTestDatabaseResponse, InputVariables<QueryTestDatabaseRequest>>
> = {
    [QueryTestDatabase.Query1]: query1,
}

/** Apollo params for {@link queryTestDatabase}. */
interface QueryTestDatabaseParams extends QueryParams<QueryTestDatabase, QueryTestDatabaseRequest> {
    request: QueryTestDatabaseRequest
}

/** Connects read only to the owner database and lists its tables. Rejects with the back end failure. */
export const queryTestDatabase = async ({
    query = QueryTestDatabase.Query1,
    request,
    signal,
}: QueryTestDatabaseParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
