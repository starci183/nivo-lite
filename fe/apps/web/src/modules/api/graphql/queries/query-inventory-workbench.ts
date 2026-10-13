import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `inventoryWorkbench` query. */
type QueryInventoryWorkbenchResponse = Pick<Query, "inventoryWorkbench">

const query1: TypedDocumentNode<QueryInventoryWorkbenchResponse> = gql`
    query InventoryWorkbench {
        inventoryWorkbench {
            canManage
            defaultLocationId
            items {
                active
                aliases
                category
                costVnd
                id
                levels {
                    locationId
                    qty
                }
                name
                onOrder
                reorderPoint
                reorderQty
                sellPriceVnd
                sku
                status
                supplierId
                total
                unit
                units {
                    factor
                    unit
                }
            }
            locations {
                id
                name
            }
            metrics {
                itemCount
                lowCount
                openPos
                outCount
                pendingCount
                valueVnd
            }
            movements {
                byName
                createdAt
                evidence
                id
                itemName
                kind
                qty
                qtyAfter
                reason
                refLabel
                unit
            }
            nowIso
            pending {
                action
                createdAt
                draft
                id
                poId
                summary
            }
            pos {
                channel
                createdAt
                expectedAt
                id
                lines {
                    id
                    itemId
                    name
                    qtyOrdered
                    qtyReceived
                    unit
                    unitCost
                }
                message
                poNo
                reminders
                sendNote
                sentVia
                source
                status
                supplierId
                supplierName
                totalVnd
                workItemId
            }
            recipes {
                aliases
                id
                lines {
                    itemId
                    name
                    qty
                    unit
                }
                name
            }
            stockOuts7d
            suppliers {
                channel
                contactName
                email
                id
                leadTimeDays
                name
                note
                paymentTerms
                phone
                zalo
            }
        }
    }
`

enum QueryInventoryWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryInventoryWorkbench, TypedDocumentNode<QueryInventoryWorkbenchResponse>> = {
    [QueryInventoryWorkbench.Query1]: query1,
}

/** Apollo params for {@link queryInventoryWorkbench}. */
type QueryInventoryWorkbenchParams = QueryParams<QueryInventoryWorkbench>

/** Runs the `inventoryWorkbench` query. */
export const queryInventoryWorkbench = async ({
    query = QueryInventoryWorkbench.Query1,
    signal,
}: QueryInventoryWorkbenchParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
