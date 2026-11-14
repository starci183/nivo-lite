import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ContactWorkQuery, ContactWorkQueryVariables } from "../__generated__/graphql"

/** The response of the `contactWork` query: the typed payload straight from the back end contract. */
type QueryContactWorkResponse = ContactWorkQuery

/** The input of the `contactWork` query: the person and the most rows. */
type QueryContactWorkRequest = WireInput<ContactWorkQueryVariables["input"]>

type Document = TypedDocumentNode<QueryContactWorkResponse, InputVariables<QueryContactWorkRequest>>

const query1: Document = gql`
    query ContactWork($input: ContactWorkInput!) {
        contactWork(input: $input) {
            id
            workflowLabel
            stepLabel
            status
            round
            at
            agentId
            agentName
            runId
        }
    }
`

enum QueryContactWork {
    Query1 = "query1",
}

const queryMap: Record<QueryContactWork, Document> = { [QueryContactWork.Query1]: query1 }

/** Apollo params for {@link queryContactWork}. */
interface QueryContactWorkParams extends QueryParams<QueryContactWork, QueryContactWorkRequest> {
    request: QueryContactWorkRequest
}

/**
 * Reads the work the agents did for one person (the back end `contactWork` query): labelled in the language of the request,
 * newest first. Read only.
 */
export const queryContactWork = async ({
    query = QueryContactWork.Query1,
    request,
    signal,
}: QueryContactWorkParams): Promise<ApolloClient.QueryResult<QueryContactWorkResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
