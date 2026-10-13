import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LeadGenWorkbenchQuery, LeadGenWorkbenchQueryVariables } from "../__generated__/graphql"

/** The contract emitted by the Lead Gen workbench resolver. */
type QueryLeadGenWorkbenchRequest = WireInput<LeadGenWorkbenchQueryVariables["input"]>

type Document = TypedDocumentNode<LeadGenWorkbenchQuery, InputVariables<QueryLeadGenWorkbenchRequest>>

const query1: Document = gql`
    query LeadGenWorkbench($input: ReadLeadGenWorkbenchInput!) {
        leadGenWorkbench(input: $input) {
            metrics {
                newToday
                hotWaiting
                firstReplyP50Min
                firstReplySample
                conversionWindowDays
                conversionLeads
                conversionWon
            }
            leads {
                id
                name
                stage
                score
                lastText
                lastAt
                createdAt
                href
                origin {
                    platform
                    kind
                    refKind
                    refId
                    refLabel
                }
            }
            leadsHidden
            sources {
                key
                leads
                hot
                won
                origin {
                    platform
                    kind
                    refKind
                    refId
                    refLabel
                }
            }
            comments {
                workItemId
                platform
                author
                comment
                draft
                refLabel
                at
            }
            handoffs {
                key
                leadId
                name
                score
                at
                classify
                stage
                href
            }
        }
    }
`

enum QueryLeadGenWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadGenWorkbench, Document> = { [QueryLeadGenWorkbench.Query1]: query1 }

/** Reads Lead Gen prospects and decisions through the authenticated API. */
export const queryLeadGenWorkbench = async ({
    query = QueryLeadGenWorkbench.Query1,
    request = {},
    signal,
}: QueryParams<QueryLeadGenWorkbench, QueryLeadGenWorkbenchRequest> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
