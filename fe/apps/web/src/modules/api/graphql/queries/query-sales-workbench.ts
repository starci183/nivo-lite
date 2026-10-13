import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { SalesWorkbenchQuery } from "../__generated__/graphql"

/** Generated response of the salesWorkbench query. */
type QuerySalesWorkbenchResponse = SalesWorkbenchQuery

type Document = TypedDocumentNode<QuerySalesWorkbenchResponse>

const query1: Document = gql`
    query SalesWorkbench {
        salesWorkbench {
            activity {
                action
                at
                customer
                evidence
                evidenceState
                href
                id
                leadId
                summary
            }
            attention {
                action
                company
                customer
                decisionId
                key
                kind
                leadId
                missing
                need
                owner
                since
                stage
                workItemId
            }
            closedHidden {
                lost
                won
            }
            contracts {
                amountVnd
                customerName
                endsOn
                id
                leadId
                note
                plan
                startsOn
                status
            }
            deals {
                channel
                closedAt
                closedReason
                company
                createdAt
                customer
                dueAt
                leadId
                need
                nextStep
                owner
                stage
                valueSource
                valueVnd
            }
            decided {
                action
                createdAt
                decidedBy
                deciderKind
                department
                id
                leadId
                leadName
                note
                outcome
                reason
                workItemId
            }
            decisions {
                action
                amountVnd
                assignedStaffId
                assignedStaffName
                createdAt
                customer
                draft
                executionId
                hasAmount
                id
                leadId
                missing
                reason
                source
                summary
                workItemId
            }
            handoffs {
                amountVnd
                canHandoff
                canShip
                carrier
                confirmedAt
                customer
                invoice {
                    amountVnd
                    issuedAt
                    no
                    paidAt
                    status
                }
                items
                key
                leadId
                orderId
                orderNo
                orderStatus
                shippedAt
                trackingCode
                work {
                    error
                    id
                    reason
                    status
                }
            }
            leadOptions {
                id
                name
            }
            metrics {
                conversion {
                    leads
                    sources {
                        leads
                        source
                        won
                    }
                    windowDays
                    won
                }
                openCount
                proposalCount
                proposalValueVnd
                waitingCount
                wonCount
                wonValueVnd
            }
            nowIso
            staff {
                id
                name
            }
        }
    }
`

enum QuerySalesWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QuerySalesWorkbench, Document> = {
    [QuerySalesWorkbench.Query1]: query1,
}

/** Apollo parameters for the salesWorkbench query. */
type QuerySalesWorkbenchParams = QueryParams<QuerySalesWorkbench>

/** Runs the workspace-scoped salesWorkbench query through the authenticated GraphQL client. */
export const querySalesWorkbench = async ({
    query = QuerySalesWorkbench.Query1,
    signal,
    headers,
}: QuerySalesWorkbenchParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
