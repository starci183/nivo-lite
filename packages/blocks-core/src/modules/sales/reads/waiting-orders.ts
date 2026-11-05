import type { WaitingOrder } from "../../../rules/sales/waiting"
import { WAITING_SHOWN } from "../constants"
import type { LeadStore, OrderStore, SettingsStore } from "../ports"
import { settingsOf } from "../settings-store"

/** The stores the waiting orders are read from. */
export interface WaitingStores {
    /** The customers. */
    readonly leads: LeadStore
    /** The orders. */
    readonly orders: OrderStore
    /** The sales settings. */
    readonly settings: SettingsStore
}

/** The orders that wait for the owner and how many wait in all. */
export interface WaitingOrders {
    /** The orders shown. */
    readonly rows: ReadonlyArray<WaitingOrder>
    /** How many orders wait. */
    readonly total: number
}

/** The orders that wait for the owner, with the name of their customer, and how many wait in all. */
export const waitingOrdersOf = async (stores: WaitingStores): Promise<WaitingOrders> => {
    const page = await stores.orders.waiting(await settingsOf(stores.settings), WAITING_SHOWN)
    const leadIds = page.rows.flatMap((order) => (order.leadId === null ? [] : [order.leadId]))
    const names: Readonly<Record<string, string>> =
        leadIds.length === 0 ? {} : await stores.leads.names([...new Set(leadIds)])
    return {
        total: page.total,
        rows: page.rows.map((order) => ({
            id: order.id,
            orderNo: order.orderNo,
            items: order.items,
            amountVnd: order.amountVnd,
            customer: order.leadId === null ? null : (names[order.leadId] ?? null),
        })),
    }
}
