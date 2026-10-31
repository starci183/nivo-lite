import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { AccountingWorkbenchQuery } from "../__generated__/graphql"

type QueryAccountingWorkbenchResponse = AccountingWorkbenchQuery

const query1: TypedDocumentNode<QueryAccountingWorkbenchResponse> = gql`
    query AccountingWorkbench {
        accountingWorkbench {
            now
            ownerName
            canAdjust
            adjustmentsReady
            excludedTest
            periods {
                this {
                    key
                    fromIso
                    toIso
                    income {
                        vnd
                        count
                    }
                    receivable {
                        vnd
                        count
                    }
                    unmatched {
                        vnd
                        count
                    }
                    weeks {
                        startIso
                        vnd
                    }
                }
                last {
                    key
                    fromIso
                    toIso
                    income {
                        vnd
                        count
                    }
                    receivable {
                        vnd
                        count
                    }
                    unmatched {
                        vnd
                        count
                    }
                    weeks {
                        startIso
                        vnd
                    }
                }
            }
            ageing {
                d0 {
                    vnd
                    count
                }
                d30 {
                    vnd
                    count
                }
                d60 {
                    vnd
                    count
                }
            }
            waiting {
                count
                knownVnd
                unknownAmount
            }
            creditsSource
            payablesSource
            reminderDays
            upcoming {
                source
                kind
                ref
                dueOn
                daysLeft
                amountVnd
                note
            }
            credits {
                id
                occurredAt
                amount
                payer
                reference
                match
                invoiceNo
                sourceKind
            }
            invoices {
                id
                invoiceNo
                amount
                status
                customer
                issuedAt
                paidAt
                dueAt
                createdAt
                orderNo
            }
            ordersWithoutInvoice {
                id
                orderNo
                items
                amount
                customer
                createdAt
            }
            questions {
                group
                item {
                    id
                    workspaceId
                    department
                    action
                    subjectType
                    subjectId
                    leadId
                    inboundEventId
                    parentId
                    chainId
                    depth
                    status
                    decidedPath
                    reason
                    reasons
                    missingFields
                    error
                    evidenceState
                    assignedStaffId
                    assignedStaffName
                    executionId
                    createdAt
                    updatedAt
                    completedAt
                    installationId
                    lead {
                        id
                        contactName
                        company
                        channel
                    }
                    proposal {
                        summary
                        draft
                        amountVnd
                        confidence
                        outcome
                        fields {
                            name
                            text
                            number
                        }
                        candidates {
                            id
                            label
                            amountVnd
                        }
                    }
                    result {
                        summary
                        href
                    }
                }
            }
            staff {
                id
                workspaceId
                name
                role
                email
                active
                createdAt
            }
            ledger {
                id
                targetType
                targetId
                at
                description
                kind
                amount
                status
                linked
                adjustmentCount
                lineage {
                    kind
                    title
                    detail
                    at
                    status
                    amount
                }
            }
        }
    }
`

enum QueryAccountingWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryAccountingWorkbench, typeof query1> = { [QueryAccountingWorkbench.Query1]: query1 }

/** Loads the selected workspace's complete accounting read model. */
export const queryAccountingWorkbench = async ({
    query = QueryAccountingWorkbench.Query1,
    signal,
}: QueryParams<QueryAccountingWorkbench> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
