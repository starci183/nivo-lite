import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ContactMessagesQuery, ContactMessagesQueryVariables } from "../__generated__/graphql"

/** The response of the `contactMessages` query: the typed payload straight from the back end contract. */
type QueryContactMessagesResponse = ContactMessagesQuery

/** The input of the `contactMessages` query: the person, the route to narrow to, the cursor of the page before, the most lines. */
type QueryContactMessagesRequest = WireInput<ContactMessagesQueryVariables["input"]>

type Document = TypedDocumentNode<QueryContactMessagesResponse, InputVariables<QueryContactMessagesRequest>>

const query1: Document = gql`
    query ContactMessages($input: ContactMessagesInput!) {
        contactMessages(input: $input) {
            next
            rows {
                id
                routeId
                direction
                text
                saidAt
                channel
                accountId
                state
                orderJson
                speaker {
                    kind
                    name
                }
                files {
                    url
                    name
                    contentType
                    caption
                }
            }
        }
    }
`

enum QueryContactMessages {
    Query1 = "query1",
}

const queryMap: Record<QueryContactMessages, Document> = { [QueryContactMessages.Query1]: query1 }

/** Apollo params for {@link queryContactMessages}. */
interface QueryContactMessagesParams extends QueryParams<QueryContactMessages, QueryContactMessagesRequest> {
    request: QueryContactMessagesRequest
}

/**
 * Reads one page of the conversation with a person (the back end `contactMessages` query): every route in one read, or one route
 * when `routeId` is given; newest first, with the cursor of the older page. Read only.
 */
export const queryContactMessages = async ({
    query = QueryContactMessages.Query1,
    request,
    signal,
}: QueryContactMessagesParams): Promise<ApolloClient.QueryResult<QueryContactMessagesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
