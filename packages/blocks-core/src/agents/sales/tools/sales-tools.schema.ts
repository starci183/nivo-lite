import { z } from "zod"
import type { PluginToolJson } from "@nivo-lite/agent-sdk/plugin-tools"
import { CLAIMS, OPEN_ORDERS, ORDER_ROWS } from "./sales-tools.limits"

/** An id the door may fill from the run token; a caller that names one names its own or is refused. */
const lockedId: z.ZodOptional<z.ZodString> = z.string().min(1).max(200).optional()

/** A record id a caller names. */
const recordId: z.ZodString = z.string().min(1).max(200)

type LockedLimit = z.ZodObject<
    { limit: z.ZodOptional<z.ZodNumber>; conversationId: z.ZodOptional<z.ZodString>; contactId: z.ZodOptional<z.ZodString>; leadId: z.ZodOptional<z.ZodString> },
    z.core.$strict
>

type LockedOnly = z.ZodObject<
    { conversationId: z.ZodOptional<z.ZodString>; contactId: z.ZodOptional<z.ZodString>; leadId: z.ZodOptional<z.ZodString> },
    z.core.$strict
>

type OrderGet = z.ZodObject<
    { orderId: z.ZodString; conversationId: z.ZodOptional<z.ZodString>; contactId: z.ZodOptional<z.ZodString>; leadId: z.ZodOptional<z.ZodString> },
    z.core.$strict
>

/** The validator of `order.get`: the order, and the ids the door may fill. */
export const ORDER_GET_SCHEMA: OrderGet = z
    .object({ orderId: recordId, conversationId: lockedId, contactId: lockedId, leadId: lockedId })
    .strict()

/** The validator of `order.open.list`: how many orders at most, and the ids the door may fill. */
export const ORDER_OPEN_LIST_SCHEMA: LockedLimit = z
    .object({ limit: z.number().int().min(1).max(OPEN_ORDERS.max).optional(), conversationId: lockedId, contactId: lockedId, leadId: lockedId })
    .strict()

/** The validator of `payment.claim.list`: how many claims at most, and the ids the door may fill. */
export const PAYMENT_CLAIM_LIST_SCHEMA: LockedLimit = z
    .object({ limit: z.number().int().min(1).max(CLAIMS.max).optional(), conversationId: lockedId, contactId: lockedId, leadId: lockedId })
    .strict()

/** The validator of `lead.care.get`: only the ids the door may fill. */
export const LEAD_CARE_GET_SCHEMA: LockedOnly = z.object({ conversationId: lockedId, contactId: lockedId, leadId: lockedId }).strict()

/** The validator of `lead.order.list`: how many orders at most, and the ids the door may fill. */
export const LEAD_ORDER_LIST_SCHEMA: LockedLimit = z
    .object({ limit: z.number().int().min(1).max(ORDER_ROWS.max).optional(), conversationId: lockedId, contactId: lockedId, leadId: lockedId })
    .strict()

/** The schemas the manifest advertises: what the model may say, never the ids the door fills. */
export const ORDER_GET_INPUT_SCHEMA: PluginToolJson = z.toJSONSchema(z.object({ orderId: recordId }).strict(), { io: "input" })
export const ORDER_OPEN_LIST_INPUT_SCHEMA: PluginToolJson = z.toJSONSchema(
    z.object({ limit: z.number().int().min(1).max(OPEN_ORDERS.max).optional() }).strict(),
    { io: "input" },
)
export const PAYMENT_CLAIM_LIST_INPUT_SCHEMA: PluginToolJson = z.toJSONSchema(
    z.object({ limit: z.number().int().min(1).max(CLAIMS.max).optional() }).strict(),
    { io: "input" },
)
export const LEAD_CARE_GET_INPUT_SCHEMA: PluginToolJson = z.toJSONSchema(z.object({}).strict(), { io: "input" })
export const LEAD_ORDER_LIST_INPUT_SCHEMA: PluginToolJson = z.toJSONSchema(
    z.object({ limit: z.number().int().min(1).max(ORDER_ROWS.max).optional() }).strict(),
    { io: "input" },
)
