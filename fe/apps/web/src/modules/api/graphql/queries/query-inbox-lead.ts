import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { InboxLeadQuery, InboxLeadQueryVariables } from "../__generated__/graphql"

/** Generated variables of one opened customer. */
type QueryInboxLeadRequest = WireInput<InboxLeadQueryVariables["input"]>

/** Generated selection returned for one opened customer. */
type QueryInboxLeadResponse = InboxLeadQuery

type Document = TypedDocumentNode<QueryInboxLeadResponse, InputVariables<QueryInboxLeadRequest>>

const query1: Document = gql`
    query InboxLead($input: InboxLeadInput!) {
        inboxLead(input: $input) {
            lead {
                id
                name
                channel
                via
                stage
                chips
                summary
                lastAt
                firstAt
                needsOwner
                agentId
                agentName
                agentAvatarUrl
                amountVnd
                eventCount
                isUnmatched
            }
            phone
            email
            zaloLinked
            approval {
                orderId
                orderNo
                amountVnd
                itemsText
                agentName
            }
            needs {
                summary
                items
                valueVnd
                delivery
                note
            }
            timeline {
                id
                kind
                at
                channel
                text
                status
                amountVnd
            }
            source {
                channel
                via
                landing
                campaign
                device
            }
            orders {
                id
                orderNo
                status
                amountVnd
                itemsText
                createdAt
            }
            paidVnd
            paidCount
        }
    }
`

enum QueryInboxLead {
    Query1 = "query1",
}

const queryMap: Record<QueryInboxLead, Document> = {
    [QueryInboxLead.Query1]: query1,
}

/** Apollo parameters for one opened customer. */
type QueryInboxLeadParams = QueryParams<QueryInboxLead, QueryInboxLeadRequest> & {
    /** The customer to open. */
    readonly request: QueryInboxLeadRequest
}

/** Opens one customer of the workspace the Apollo context link selects. */
export const queryInboxLead = ({
    query = QueryInboxLead.Query1,
    request,
    signal,
    headers,
}: QueryInboxLeadParams): Promise<ApolloClient.QueryResult<QueryInboxLeadResponse>> =>
    createAuthApolloClient({ signal, headers }).query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
