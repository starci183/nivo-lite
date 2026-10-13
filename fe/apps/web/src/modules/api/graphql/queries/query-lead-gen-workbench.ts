import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadGenWorkbenchArgs } from "../__generated__/schema"

/** Generated input of the leadGenWorkbench query. */
export type QueryLeadGenWorkbenchRequest = QueryLeadGenWorkbenchArgs["input"]

/** Generated response of the leadGenWorkbench query. */
type QueryLeadGenWorkbenchResponse = Pick<Query, "leadGenWorkbench">

type Document = TypedDocumentNode<QueryLeadGenWorkbenchResponse, InputVariables<QueryLeadGenWorkbenchRequest>>

const query1: Document = gql`
    query LeadGenWorkbench($input: ReadLeadGenWorkbenchInput!) {
        leadGenWorkbench(input: $input) {
            comments {
                at
                author
                comment
                draft
                platform
                refLabel
                workItemId
            }
            handoffs {
                at
                classify
                href
                key
                leadId
                name
                score
                stage
            }
            leads {
                createdAt
                href
                id
                lastAt
                lastText
                name
                origin {
                    kind
                    platform
                    refId
                    refKind
                    refLabel
                }
                score
                stage
            }
            leadsHidden
            metrics {
                conversionLeads
                conversionWindowDays
                conversionWon
                firstReplyP50Min
                firstReplySample
                hotWaiting
                newToday
            }
            sources {
                hot
                key
                leads
                origin {
                    kind
                    platform
                    refId
                    refKind
                    refLabel
                }
                won
            }
        }
    }
`

enum QueryLeadGenWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadGenWorkbench, Document> = {
    [QueryLeadGenWorkbench.Query1]: query1,
}

/** Apollo parameters for the leadGenWorkbench query. */
type QueryLeadGenWorkbenchParams = QueryParams<QueryLeadGenWorkbench, QueryLeadGenWorkbenchRequest> & {
    request: QueryLeadGenWorkbenchRequest
}

/** Runs the workspace-scoped leadGenWorkbench query through the authenticated GraphQL client. */
export const queryLeadGenWorkbench = async ({
    query = QueryLeadGenWorkbench.Query1,
    request,
    signal,
    headers,
}: QueryLeadGenWorkbenchParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
