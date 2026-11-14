import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ContactsQuery, ContactsQueryVariables } from "../__generated__/graphql"

/** The response of the `contacts` query: the typed payload straight from the back end contract. */
type QueryContactsResponse = ContactsQuery

/** The input of the `contacts` query: the search, the page size and the cursor the page starts after. */
type QueryContactsRequest = WireInput<ContactsQueryVariables["input"]>

type Document = TypedDocumentNode<QueryContactsResponse, InputVariables<QueryContactsRequest>>

const query1: Document = gql`
    query Contacts($input: ContactsInput!) {
        contacts(input: $input) {
            next
            contacts {
                id
                displayName
                tags
                createdAt
                updatedAt
                identities {
                    id
                    kind
                    provider
                    account
                    value
                    verified
                    verifiedBy
                    source
                    joinedBy
                    at
                }
            }
        }
    }
`

enum QueryContacts {
    Query1 = "query1",
}

const queryMap: Record<QueryContacts, Document> = { [QueryContacts.Query1]: query1 }

/** Apollo params for {@link queryContacts}. */
interface QueryContactsParams extends QueryParams<QueryContacts, QueryContactsRequest> {
    request: QueryContactsRequest
}

/** Lists the people of the workspace a page at a time, newest activity first (the back end `contacts` query). */
export const queryContacts = async ({
    query = QueryContacts.Query1,
    request,
    headers,
    signal,
}: QueryContactsParams): Promise<ApolloClient.QueryResult<QueryContactsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
        fetchPolicy: "no-cache",
    })
}
