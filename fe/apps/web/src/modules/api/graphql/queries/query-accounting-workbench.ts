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
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    receivable {
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    unmatched {
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    weeks {
                        startIso
                        live
                        simulated
                    }
                }
                last {
                    key
                    fromIso
                    toIso
                    income {
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    receivable {
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    unmatched {
                        vnd {
                            live
                            simulated
                        }
                        count {
                            live
                            simulated
                        }
                    }
                    weeks {
                        startIso
                        live
                        simulated
                    }
                }
            }
            ageing {
                d0 {
                    vnd {
                        live
                        simulated
                    }
                    count {
                        live
                        simulated
                    }
                }
                d30 {
                    vnd {
                        live
                        simulated
                    }
                    count {
                        live
                        simulated
                    }
                }
                d60 {
                    vnd {
                        live
                        simulated
                    }
                    count {
                        live
                        simulated
                    }
                }
            }
            waiting {
                count {
                    live
                    simulated
                }
                knownVnd
                unknownAmount
            }
            credits {
                id
                occurredAt
                amount
                payer
                reference
                origin
                match
                invoiceNo
                sourceKind
            }
            invoices {
                id
                invoiceNo
                amount
                status
                origin
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
                origin
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
                    origin
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
                origin
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
