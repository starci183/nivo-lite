import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `dashboard` query: the typed payload straight from the back end contract. */
type QueryDashboardResponse = Pick<Query, "dashboard">

const query1: TypedDocumentNode<QueryDashboardResponse> = gql`
    query Dashboard {
        dashboard {
            since7
            agents {
                id
                module
                name
                handle
                role
                instructions
                knowledge
                greeting
                approvalRule
                status
                createdAt
            }
            events {
                id
                leadId
                kind
                actor
                summary
                evidence
                createdAt
            }
            leads {
                id
                stage
                createdAt
                contactName
                company
            }
            pending {
                id
                responsibilityId
                leadId
                createdAt
            }
            responsibilities {
                id
                leadId
                title
                ownerKind
                ownerAgentId
                ownerName
                nextAction
                dueAt
                status
                createdAt
                lead {
                    id
                    contactName
                    company
                    stage
                }
            }
            promo {
                isFoundingMember
                hasCustomerConversation
                hasLeadConversation
                approvedCount
                hasWon
                invoiceApproved
                chatbot {
                    id
                    knowledge
                }
                websiteLeads {
                    id
                    createdAt
                }
                firstEvents {
                    leadId
                    at
                }
            }
            exceptions {
                id
                leadId
                department
                action
                status
                reason
                error
                summary
                contact
                customer
                origin
                executionId
                assignedStaffName
                createdAt
                lead {
                    id
                    contactName
                    company
                    channel
                }
            }
            governance {
                pendingWithoutWork
                authority {
                    goalRevenueVnd
                    goalNewCustomers
                    goalFirstReplyMinutes
                }
                leads {
                    id
                    contactName
                    company
                    origin
                    stage
                    createdAt
                }
                orders {
                    id
                    leadId
                    orderNo
                    items
                    amountVnd
                    status
                    origin
                }
                invoices {
                    id
                    orderId
                    leadId
                    invoiceNo
                    amountVnd
                    status
                    origin
                }
                transactions {
                    id
                    invoiceId
                    payer
                    reference
                    amountVnd
                    status
                    origin
                }
                work {
                    id
                    leadId
                    department
                    status
                    reason
                    decidedPath
                    createdAt
                    updatedAt
                    completedAt
                    summary
                    contact
                    customer
                }
                decisions7 {
                    workItemId
                    leadId
                    deciderKind
                    outcome
                    createdAt
                }
                recent {
                    id
                    workItemId
                    leadId
                    leadName
                    department
                    action
                    decidedBy
                    deciderKind
                    outcome
                    reason
                    note
                    createdAt
                }
            }
        }
    }
`

enum QueryDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryDashboard, TypedDocumentNode<QueryDashboardResponse>> = {
    [QueryDashboard.Query1]: query1,
}

/** Apollo params for {@link queryDashboard}. */
type QueryDashboardParams = QueryParams<QueryDashboard>

/** Reads everything the overview page shows about the active workspace (the back end `dashboard` query). */
export const queryDashboard = async ({ query = QueryDashboard.Query1, signal }: QueryDashboardParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
