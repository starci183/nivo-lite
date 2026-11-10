import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { InboxLeadsQuery, InboxLeadsQueryVariables } from "../__generated__/graphql"

/** Generated variables of the lead list. */
type QueryInboxLeadsRequest = WireInput<InboxLeadsQueryVariables["input"]>

/** Generated selection returned by the lead list. */
type QueryInboxLeadsResponse = InboxLeadsQuery

type Document = TypedDocumentNode<QueryInboxLeadsResponse, InputVariables<QueryInboxLeadsRequest>>

const query1: Document = gql`
    query InboxLeads($input: InboxLeadsInput!) {
        inboxLeads(input: $input) {
            leads {
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
            counts {
                all
                new
                needsYou
                ordered
                paid
            }
            figures {
                visitors7d
                newToday
                needsYou
                autoReplyPct
                avgResponseSeconds
            }
            agents {
                id
                name
            }
        }
    }
`

enum QueryInboxLeads {
    Query1 = "query1",
}

const queryMap: Record<QueryInboxLeads, Document> = {
    [QueryInboxLeads.Query1]: query1,
}

/** Apollo parameters for the lead list. */
type QueryInboxLeadsParams = QueryParams<QueryInboxLeads, QueryInboxLeadsRequest>

/** Reads the customers of the inbox, the counts of every tab, the figures and the agents of the workspace the Apollo context link selects. */
export const queryInboxLeads = ({
    query = QueryInboxLeads.Query1,
    request = { tab: "all", sort: "recent", limit: 60 },
    signal,
    headers,
}: QueryInboxLeadsParams = {}): Promise<ApolloClient.QueryResult<QueryInboxLeadsResponse>> =>
    createAuthApolloClient({ signal, headers }).query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
