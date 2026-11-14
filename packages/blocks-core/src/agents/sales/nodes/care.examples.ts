import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ScriptedToolCall, ToolAnswer } from "@nivo-lite/agent-sdk/template"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"
import { contextAnswer, answered, sentAnswer } from "../../../shared/nodes/tool-answers"
import { saleLeadListOf, type CareFacts, type CareOrder } from "./care.reads"
import { orderRecordAnswerOf } from "./sales-order"

/**
 * The scripted answers the care examples share. The examples whose node reads `ctx.run.at` name `at: EXAMPLE_AT` (the instant the old
 * fake clock answered), the as-built example member for the run's instant.
 */

/** The run's instant every care example runs at. */
export const EXAMPLE_AT = "1970-01-01T00:00:00.000Z"

/** A send that went out in the customer's Zalo conversation (the send effect's facts as `value`; no account). */
export const SENT_VIA_ZALO: ToolAnswer<JsonObject> = sentAnswer("m1", "conv-l1")

/** A post to the team chat that went out (NIVO's own chat: no account). */
export const POSTED: ToolAnswer<JsonObject> = answered({ messageId: "t1" })

/** A timer the timer tool armed (or moved): its key and when it is due. */
export const ARMED: ToolAnswer<JsonObject> = answered({ ref: "timer-1", dueAt: "1970-01-02T00:00:00.000Z" })

/** The profile read of customer `l1`, named An (a context read: one fact). */
export const PROFILE_AN: ToolAnswer<JsonObject> = contextAnswer("nivo.lead", [{ id: "l1", name: "An" }])

/** The care read of customer `l1` who did not opt out, named no receiver and mentioned no date. */
export const CARE_OPEN: CareFacts = { leadId: "l1", optedOut: false, recipient: null, occasions: [] }

/** An order of the examples as `nivo.tool.order.get` answers it, before the changes each example makes. */
export const ORDER_O1: CareOrder = {
    id: "o1",
    orderNo: "DH-1",
    status: "paid",
    leadId: "l1",
    items: [{ name: "tea boxes", qty: 2 }],
    shippedAt: null,
    confirmedAt: null,
    delivery: { address: null, recipientName: null, recipientPhone: null, deliveryAt: null },
}

/**
 * The reads of the person of order `o1` before care's read, as the examples script them: the order record (its contact `c1`), the sale's
 * record of that person (`l1`), then care's read of it, answering `care`.
 */
export const personReadsOf = (care: ToolAnswer<JsonObject>): ReadonlyArray<ScriptedToolCall> => [
    {
        id: TOOL.recordGet,
        args: { type: SALES_ORDER_ENTITY, id: "o1" },
        answer: answered(orderRecordAnswerOf("o1", { orderNo: "DH-1", status: "paid", amountVnd: 4500, contactId: "c1" })),
    },
    { id: TOOL.recordList, args: saleLeadListOf("c1"), answer: answered({ records: [{ id: "l1", values: {} }], next: null }) },
    { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: care },
]
