import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LeadFlowQuery, LeadFlowQueryVariables } from "../__generated__/graphql"

/** Generated input of the leadFlow query. */
type QueryLeadFlowRequest = WireInput<LeadFlowQueryVariables["input"]>

/** Generated response of the leadFlow query. */
type QueryLeadFlowResponse = LeadFlowQuery

type Document = TypedDocumentNode<QueryLeadFlowResponse, InputVariables<QueryLeadFlowRequest>>

const query1: Document = gql`
    query LeadFlow($input: LeadFlowInput!) {
        leadFlow(input: $input) {
            decisions {
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
            invoices {
                amountVnd
                createdAt
                dueAt
                id
                invoiceNo
                issuedAt
                issuedBy
                leadId
                orderId
                paidAt
                status
                workspaceId
            }
            orders {
                amountVnd
                carrier
                confirmedAt
                confirmedBy
                createdAt
                id
                inboundEventId
                items
                leadId
                orderNo
                shippedAt
                status
                trackingCode
                workspaceId
            }
            transactions {
                amountVnd
                channel
                createdAt
                id
                inboundEventId
                invoiceId
                occurredAt
                payer
                reference
                status
                workspaceId
            }
            workItems {
                action
                assignedStaffId
                assignedStaffName
                chainId
                completedAt
                createdAt
                decidedBy
                decidedPath
                department
                depth
                error
                evidenceState
                executionId
                hasApprovalCard
                href
                id
                inboundEventId
                installationId
                lead {
                    channel
                    company
                    contactName
                    id
                }
                leadId
                missingFields
                parentId
                proposal {
                    amountVnd
                    candidates {
                        amountVnd
                        id
                        label
                    }
                    confidence
                    draft
                    fields {
                        key
                        kind
                        numberValue
                        stringValue
                    }
                    outcome
                    summary
                }
                reason
                reasons
                result {
                    href
                    summary
                }
                status
                subjectId
                subjectType
                updatedAt
                workspaceId
            }
        }
    }
`

enum QueryLeadFlow {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadFlow, Document> = {
    [QueryLeadFlow.Query1]: query1,
}

/** Apollo parameters for the leadFlow query. */
type QueryLeadFlowParams = QueryParams<QueryLeadFlow, QueryLeadFlowRequest> & { request: QueryLeadFlowRequest }

/** Runs the workspace-scoped leadFlow query through the authenticated GraphQL client. */
export const queryLeadFlow = async ({
    query = QueryLeadFlow.Query1,
    request,
    signal,
    headers,
}: QueryLeadFlowParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
