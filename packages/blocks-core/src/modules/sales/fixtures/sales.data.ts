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
    version: "1",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-04T08:00:00.000Z",
})

/** A new customer who has one small draft order. */
export const LEAD_NEW: LeadRow = lead("lead-1", "Nguyen Van An", "new", "Asks the price of the 3 month plan", null)

/** A customer in the proposal stage whose big draft order waits for the owner. */
export const LEAD_PROPOSAL: LeadRow = lead("lead-4", "Pham Quoc Dung", "proposal", "Quote of 6,000,000 VND sent", null)

/** A customer won with a paid order. */
export const LEAD_WON: LeadRow = lead("lead-5", "Hoang Thu Ha", "won", "Bought the starter set", "Paid in full")

/** The sample customers, at least one in every open stage and one won. */
export const SAMPLE_LEADS: ReadonlyArray<LeadRow> = [
    LEAD_NEW,
    lead("lead-2", "Tran Thi Binh", "new", "Wants a call back tomorrow", null),
    lead("lead-3", "Le Minh Chau", "qualified", "Needs 20 gift sets for a wedding", null),
    LEAD_PROPOSAL,
    LEAD_WON,
]

const order = (
    id: string,
    orderNo: string,
    leadId: string | null,
    items: string,
    amountVnd: number | null,
    status: OrderRow["status"],
): OrderRow => ({
    id,
    orderNo,
    leadId,
    items,
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
    "10 x gift set",
    6_000_000,
    "draft",
)

/** A confirmed order. */
export const ORDER_CONFIRMED: OrderRow = order(
    "order-3",
    "DH-20261103-0001",
    "lead-3",
    "20 x gift set",
    4_800_000,
    "confirmed",
)

/** The sample orders: two drafts (one at the owner threshold), a confirmed one, two paid and a cancelled one (its customer is gone). */
export const SAMPLE_ORDERS: ReadonlyArray<OrderRow> = [
    ORDER_WAITING,
    order("order-2", "DH-20261104-0002", "lead-1", "3 x tea", 360_000, "draft"),
    ORDER_CONFIRMED,
    order("order-4", "DH-20261102-0001", "lead-5", "1 x starter set", 1_200_000, "paid"),
    order("order-5", "DH-20261101-0001", "lead-9", "2 x cake", 240_000, "cancelled"),
    order("order-6", "DH-20261101-0002", null, "1 x walk-in sale", 100_000, "paid"),
]

/** A fresh in-memory state over the sample customers and orders; the given members hold the owner's right. */
export const sampleState = (holders: ReadonlyArray<string>): MemoryState => ({
    leads: [...SAMPLE_LEADS],
    orders: [...SAMPLE_ORDERS],
    settings: null,
    holders,
    now: SAMPLE_NOW,
})
