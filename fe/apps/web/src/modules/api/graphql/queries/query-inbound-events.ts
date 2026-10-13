import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryInboundEventsArgs } from "../__generated__/schema"

/** Generated variables of the inbox feed. */
type QueryInboundEventsRequest = QueryInboundEventsArgs["input"]

/** Generated selection returned by the inbox feed. */
type QueryInboundEventsResponse = Pick<Query, "inboundEvents">

type Document = TypedDocumentNode<QueryInboundEventsResponse, InputVariables<QueryInboundEventsRequest>>

const query1: Document = gql`
    query InboundEvents($input: InboundEventsInput!) {
        inboundEvents(input: $input) {
            id
            channel
            kind
            origin
            senderName
            senderContact
            body
            amountVnd
            externalRef
            eventId
            duplicateCount
            leadId
            status
            createdAt
        }
    }
`

enum QueryInboundEvents {
    Query1 = "query1",
}

const queryMap: Record<QueryInboundEvents, Document> = {
    [QueryInboundEvents.Query1]: query1,
}

/** Apollo parameters for the inbox feed. */
type QueryInboundEventsParams = QueryParams<QueryInboundEvents, QueryInboundEventsRequest>

/** Reads recent inputs from the workspace selected by the Apollo context link. */
export const queryInboundEvents = ({
    query = QueryInboundEvents.Query1,
    request = { limit: 40 },
    signal,
    headers,
}: QueryInboundEventsParams = {}) =>
    createAuthApolloClient({ signal, headers }).query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
