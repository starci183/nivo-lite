import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { CancelFacts } from "./rules/order-status"
import type { OrderLinkStores, OrderStanding } from "./sales.types"

/** The most claims of one status a cancellation looks through. */
const CLAIMS_SCANNED = 100

/** The claim statuses that still wait for money and are closed with their order. */
const OPEN_CLAIM_STATUSES = ["open", "escalated"] as const

/** How many records of an entity hold a field equal to a value (a count over the engine, so no index on the field is needed). */
const countOf = async (api: EntityApi, field: string, value: string): Promise<number> => {
    const [row] = await api.aggregate({ where: q.eq(field, value), measures: { n: { kind: "count" } }, limit: 1 })
    const counted = row?.measures["n"]
    return typeof counted === "number" ? counted : Number(counted ?? 0)
}

/** What the money and the paper of an order say about cancelling it: its status, the payments allocated to it, the invoices issued for it. */
export const cancelFactsOf = async (stores: OrderLinkStores, order: OrderStanding): Promise<CancelFacts> => ({
    status: order.status,
    allocations: await countOf(stores.transactions, "orderId", order.id),
    invoices: await countOf(stores.invoices, "orderId", order.id),
})

/** The claims of an order that still wait: open or escalated, each as its id and version. */
export const openClaimsOf = async (
    claims: EntityApi,
    orderId: string,
): Promise<ReadonlyArray<{ readonly id: string; readonly version: string }>> => {
    const pages = await Promise.all(
        OPEN_CLAIM_STATUSES.map((status) =>
            claims.list({
                select: ["status"],
                join: { order: [] },
                where: q.eq("status", status),
                order: [
                    ["createdAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: CLAIMS_SCANNED },
            }),
        ),
    )
    return pages
        .flatMap((page) => page.rows)
        .filter((listed) => listed.joined["order"]?.id === orderId)
        .map((listed) => ({ id: listed.row.id, version: listed.row.version }))
}
