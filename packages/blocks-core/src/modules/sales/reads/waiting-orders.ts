import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q, type FilterExpr } from "@nivo-lite/agent-sdk/query"
import type { SalesSettings } from "../../../rules/sales/settings"
import type { WaitingOrder } from "../../../rules/sales/waiting"
import { WAITING_SHOWN } from "../constants"
import { LEAD_NAME_FIELDS, ORDER_FIELDS, leadNameOf, orderRowOf } from "../sales-records"
import { settingsOf } from "../settings-store"

/** The ports the waiting orders are read from. */
export interface WaitingPorts {
    /** The orders. */
    readonly orders: EntityApi
    /** The sales settings. */
    readonly settings: EntityApi
}

/** The orders that wait for the owner and how many wait in all. */
export interface WaitingOrders {
    /** The orders shown. */
    readonly rows: ReadonlyArray<WaitingOrder>
    /** How many orders wait. */
    readonly total: number
}

/** The draft orders that wait for the owner: their total is at the threshold or above, or still unknown when the settings say it waits. */
export const waitingFilterOf = (settings: SalesSettings): FilterExpr => {
    const atThreshold = q.gte("amountVnd", settings.approvalThresholdVnd)
    return q.and(
        q.eq("status", "draft"),
        settings.draftWithoutTotalNeedsApproval ? q.or(q.isNull("amountVnd"), atThreshold) : atThreshold,
    )
}

/** The orders that wait for the owner, oldest first, with the name of their customer, and how many wait in all. */
export const waitingOrdersOf = async ({ orders, settings }: WaitingPorts): Promise<WaitingOrders> => {
    const where = waitingFilterOf(await settingsOf(settings))
    const page = await orders.list({
        select: ORDER_FIELDS,
        join: { lead: LEAD_NAME_FIELDS },
        where,
        order: [
            ["createdAt", "asc"],
            ["id", "asc"],
        ],
        page: { size: WAITING_SHOWN },
    })
    const totals = await orders.aggregate({ where, measures: { count: { kind: "count" } }, limit: 1 })
    const rows = page.rows.flatMap((listed): Array<WaitingOrder> => {
        const order = orderRowOf(listed.row)
        const buyer = listed.joined["lead"]
        return order === null
            ? []
            : [
                  {
                      id: order.id,
                      orderNo: order.orderNo,
                      items: order.itemsText,
                      amountVnd: order.amountVnd,
                      customer: buyer === undefined || buyer === null ? null : leadNameOf(buyer.data),
                  },
              ]
    })
    const count = totals[0]?.measures["count"]
    return { rows, total: typeof count === "number" ? count : rows.length }
}
