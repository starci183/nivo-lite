import { itemLinesOf, pricedLinesOf } from "../../../rules/sales/order-items"
import type { MemoryState } from "../memory"
import type { LeadRow, OrderRow } from "../sales.types"

/** The instant the sample data is read at, ISO text. */
export const SAMPLE_NOW = "2026-11-05T09:00:00.000Z"

const lead = (
    id: string,
    contactName: string,
    stage: LeadRow["stage"],
    need: string,
    closedReason: string | null,
    awaitingSince: string | null = null,
    extra: Partial<LeadRow> = {},
): LeadRow => ({
    id,
    contactName,
    company: "",
    channel: "zalo",
    need,
    stage,
    phone: "84912000701",
    email: null,
    contextSummary: null,
    closedReason,
    awaitingSince,
    owner: null,
    nextStep: null,
    nextDueAt: null,
    quoteVnd: null,
    orderVnd: null,
    note: null,
    needs: null,
    version: "1",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-04T08:00:00.000Z",
    ...extra,
})

/** A new customer who has one small draft order. */
export const LEAD_NEW: LeadRow = lead(
    "lead-1",
    "Nguy\u1ec5n V\u0103n An",
    "new",
    "H\u1ecfi gi\u00e1 g\u00f3i 3 th\u00e1ng",
    null,
    "2026-11-05T07:00:00.000Z",
    { owner: "Minh" },
)

/** A customer in the proposal stage whose big draft order waits for the owner. */
export const LEAD_PROPOSAL: LeadRow = lead(
    "lead-4",
    "Ph\u1ea1m Qu\u1ed1c D\u0169ng",
    "proposal",
    "\u0110\u00e3 g\u1eedi b\u00e1o gi\u00e1 6.000.000 \u20ab",
    null,
    null,
    { quoteVnd: 6_000_000, note: "Ch\u1edd b\u1ea1n duy\u1ec7t \u0111\u01a1n" },
)

/** A customer won with a paid order. */
export const LEAD_WON: LeadRow = lead(
    "lead-5",
    "Ho\u00e0ng Thu H\u00e0",
    "won",
    "\u0110\u00e3 mua b\u1ed9 kh\u1edfi \u0111\u1ea7u",
    "\u0110\u00e3 thanh to\u00e1n \u0111\u1ee7",
    null,
    { orderVnd: 1_200_000 },
)

/** The sample customers, at least one in every open stage and one won. */
export const SAMPLE_LEADS: ReadonlyArray<LeadRow> = [
    LEAD_NEW,
    lead(
        "lead-2",
        "Tr\u1ea7n Th\u1ecb B\u00ecnh",
        "new",
        "Mu\u1ed1n \u0111\u01b0\u1ee3c g\u1ecdi l\u1ea1i v\u00e0o ng\u00e0y mai",
        null,
        null,
        { needs: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i", phone: null },
    ),
    lead(
        "lead-3",
        "L\u00ea Minh Ch\u00e2u",
        "qualified",
        "C\u1ea7n 20 h\u1ed9p qu\u00e0 cho \u0111\u00e1m c\u01b0\u1edbi",
        null,
        null,
        { nextStep: "G\u1eedi b\u00e1o gi\u00e1", nextDueAt: "2026-11-04T09:00:00.000Z" },
    ),
    LEAD_PROPOSAL,
    LEAD_WON,
]

const order = (
    id: string,
    orderNo: string,
    leadId: string | null,
    itemsText: string,
    amountVnd: number | null,
    status: OrderRow["status"],
): OrderRow => ({
    id,
    orderNo,
    leadId,
    items: { lines: pricedLinesOf(itemLinesOf(itemsText)) },
    itemsText,
    note: "",
    amountVnd,
    status,
    confirmedBy: status === "draft" || status === "cancelled" ? null : "NIVO",
    confirmedAt: status === "draft" || status === "cancelled" ? null : "2026-11-04T09:00:00.000Z",
    shippedAt: null,
    carrier: null,
    trackingCode: null,
    version: "1",
    createdAt: "2026-11-04T08:30:00.000Z",
    updatedAt: "2026-11-04T08:30:00.000Z",
})

/** A draft at the owner threshold: it waits for the owner. */
export const ORDER_WAITING: OrderRow = order(
    "order-1",
    "DH-20261104-0001",
    "lead-4",
    "10 x h\u1ed9p qu\u00e0",
    6_000_000,
    "draft",
)

/** A confirmed order. */
export const ORDER_CONFIRMED: OrderRow = order(
    "order-3",
    "DH-20261103-0001",
    "lead-3",
    "20 x h\u1ed9p qu\u00e0",
    4_800_000,
    "confirmed",
)

/** The sample orders: two drafts (one at the owner threshold), a confirmed one, two paid and a cancelled one (its customer is gone). */
export const SAMPLE_ORDERS: ReadonlyArray<OrderRow> = [
    ORDER_WAITING,
    order("order-2", "DH-20261104-0002", "lead-1", "3 x tr\u00e0", 360_000, "draft"),
    ORDER_CONFIRMED,
    order("order-4", "DH-20261102-0001", "lead-5", "1 x b\u1ed9 kh\u1edfi \u0111\u1ea7u", 1_200_000, "paid"),
    order("order-7", "DH-20261104-0003", "lead-2", "3 x tr\u00e0 \u0111\u1eb7c bi\u1ec7t", 960_000, "failed_system"),
    order("order-5", "DH-20261101-0001", "lead-9", "2 x b\u00e1nh", 240_000, "cancelled"),
    order("order-6", "DH-20261101-0002", null, "1 x b\u00e1n t\u1ea1i qu\u1ea7y", 100_000, "paid"),
]

/** A fresh in-memory state over the sample customers and orders; the given members hold the owner's right. */
export const sampleState = (holders: ReadonlyArray<string>): MemoryState => ({
    leads: [...SAMPLE_LEADS],
    orders: [...SAMPLE_ORDERS],
    transactions: [],
    invoices: [],
    claims: [],
    settings: null,
    holders,
    now: SAMPLE_NOW,
})
