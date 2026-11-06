import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { ORDER_ITEMS_SHAPE } from "../../entities/sales/order.entity"
import { ORDER_STATUSES } from "../../rules/sales/order-status"
import { MAX_DISCOUNT_PCT, MAX_REMIND_DAYS } from "../../rules/sales/settings"
import type { SalesSettings } from "../../rules/sales/settings"
import type { OrderBrief } from "../../rules/sales/lead-orders"
import { LEAD_STAGES, MAX_REASON_CHARS } from "../../rules/sales/stage"
import type { LeadRow, OrderRow } from "./sales.types"

/** The longest ISO 8601 text the engine writes for a time. */
const MAX_TIME = 40

/** The longest order total, VND. */
const MAX_VND = 1_000_000_000_000

/** A value or null, read as null when the engine left the key out. */
const orNull = <T extends z.ZodType>(schema: T) =>
    schema
        .nullable()
        .optional()
        .transform((value) => value ?? null)

const nullableText = (max: number) => orNull(z.string().max(max))

/** The declared fields of a `sales.lead` record. */
const leadData = z.object({
    contactName: z.string().max(MAX_LINE),
    company: nullableText(MAX_LINE),
    channel: z.string().max(MAX_ID),
    need: nullableText(MAX_BODY),
    stage: z.enum(LEAD_STAGES),
    phone: nullableText(MAX_LINE),
    email: nullableText(MAX_LINE),
    contextSummary: nullableText(MAX_BODY),
    closedReason: nullableText(MAX_REASON_CHARS),
    awaitingSince: nullableText(MAX_TIME),
    owner: nullableText(MAX_LINE),
    nextStep: nullableText(MAX_LINE),
    nextDueAt: nullableText(MAX_TIME),
    quoteVnd: orNull(z.number().int().min(0).max(MAX_VND)),
    orderVnd: orNull(z.number().int().min(0).max(MAX_VND)),
    note: nullableText(MAX_BODY),
    needs: nullableText(MAX_LINE),
})

/** The declared fields of a `sales.order` record. */
const orderData = z.object({
    orderNo: z.string().max(MAX_ID),
    leadId: nullableText(MAX_ID),
    items: ORDER_ITEMS_SHAPE,
    itemsText: z.string().max(MAX_BODY),
    note: z.string().max(MAX_BODY),
    amountVnd: orNull(z.number().int().min(0).max(MAX_VND)),
    status: z.enum(ORDER_STATUSES),
    confirmedBy: nullableText(MAX_LINE),
    confirmedAt: nullableText(MAX_TIME),
    shippedAt: nullableText(MAX_TIME),
    carrier: nullableText(MAX_LINE),
    trackingCode: nullableText(MAX_LINE),
})

/** The declared fields of the `sales.settings` record. */
const settingsData = z.object({
    approvalThresholdVnd: z.number().int().min(0).max(MAX_VND),
    draftWithoutTotalNeedsApproval: z.boolean(),
    closedDealsCanFlip: z.boolean(),
    reopenNeedsApproval: z.boolean(),
    maxDiscountPct: z.number().int().min(0).max(MAX_DISCOUNT_PCT),
    remindAfterDays: z.number().int().min(1).max(MAX_REMIND_DAYS),
    autoWon: z.boolean(),
    notifyAccounting: z.boolean(),
})

/** The fields of an order a customer's detail adds up. */
const orderBriefData = z.object({
    orderNo: z.string().max(MAX_ID),
    status: z.enum(ORDER_STATUSES),
    amountVnd: orNull(z.number().int().min(0).max(MAX_VND)),
})

/** The name a customer is shown under. */
const leadNameData = z.object({ contactName: z.string().max(MAX_LINE) })

/** The fields a query for lead rows selects. */
export const LEAD_FIELDS: ReadonlyArray<string> = [
    "contactName",
    "company",
    "channel",
    "need",
    "stage",
    "phone",
    "email",
    "contextSummary",
    "closedReason",
    "awaitingSince",
    "owner",
    "nextStep",
    "nextDueAt",
    "quoteVnd",
    "orderVnd",
    "note",
    "needs",
]

/** The fields a query for order rows selects. */
export const ORDER_FIELDS: ReadonlyArray<string> = [
    "orderNo",
    "leadId",
    "items",
    "itemsText",
    "note",
    "amountVnd",
    "status",
    "confirmedBy",
    "confirmedAt",
    "shippedAt",
    "carrier",
    "trackingCode",
]

/** The fields a query for the orders a customer's detail adds up selects. */
export const ORDER_BRIEF_FIELDS: ReadonlyArray<string> = ["orderNo", "status", "amountVnd"]

/** The fields a query for a customer's name selects. */
export const LEAD_NAME_FIELDS: ReadonlyArray<string> = ["contactName"]

/** The lead a record holds; null when its fields are not those of a lead. */
export const leadRowOf = (record: RecordRow): LeadRow | null => {
    const parsed = leadData.safeParse(record.data)
    return parsed.success
        ? {
              id: record.id,
              version: record.version,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              ...parsed.data,
          }
        : null
}

/** The leads a page of rows holds; a row whose fields are not those of a lead is left out. */
export const leadRowsOf = (rows: ReadonlyArray<{ readonly row: RecordRow }>): ReadonlyArray<LeadRow> =>
    rows.flatMap((listed) => leadRowOf(listed.row) ?? [])

/** The order a record holds; null when its fields are not those of an order. */
export const orderRowOf = (record: RecordRow): OrderRow | null => {
    const parsed = orderData.safeParse(record.data)
    return parsed.success
        ? {
              id: record.id,
              version: record.version,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              ...parsed.data,
          }
        : null
}

/** The order a record holds as far as a customer's detail needs it; null when its fields are not those of an order. */
export const orderBriefOf = (record: RecordRow): OrderBrief | null => {
    const parsed = orderBriefData.safeParse(record.data)
    return parsed.success ? { ...parsed.data, createdAt: record.createdAt } : null
}

/** The fields a query for the settings record selects. */
export const SETTINGS_FIELDS: ReadonlyArray<string> = [
    "approvalThresholdVnd",
    "draftWithoutTotalNeedsApproval",
    "closedDealsCanFlip",
    "reopenNeedsApproval",
    "maxDiscountPct",
    "remindAfterDays",
    "autoWon",
    "notifyAccounting",
]

/** The settings a record holds; null when its fields are not those of the settings. */
export const settingsRowOf = (record: RecordRow): SalesSettings | null => {
    const parsed = settingsData.safeParse(record.data)
    return parsed.success ? parsed.data : null
}

/** The name a lead record is shown under; null when its fields are not those of a lead. */
export const leadNameOf = (data: Readonly<Record<string, unknown>>): string | null => {
    const parsed = leadNameData.safeParse(data)
    return parsed.success ? parsed.data.contactName : null
}
