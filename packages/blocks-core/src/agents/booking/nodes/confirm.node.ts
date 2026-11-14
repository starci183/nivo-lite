import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { BOOKING_TYPES, bookingById, recordAnswer } from "./booking.reads"

const ID = "booking.confirm"

/** The booking to confirm. */
export interface ConfirmInput {
    /** The booking the booking step recorded (null on a route that recorded none: nothing to confirm). */
    readonly bookingId: string | null
}

/** What the confirmation did. */
export interface ConfirmOutput {
    /** The booking, echoed. */
    readonly bookingId: string | null
    /** `confirmed` the booking is confirmed; `declined` a person declined it on its card; `settled` nothing to confirm (gone, or no longer requested). */
    readonly result: "confirmed" | "declined" | "settled"
}

const input: NodeSchema<ConfirmInput> = z.object({ bookingId: z.string().max(MAX_ID).nullable() })

const output: NodeSchema<ConfirmOutput> = z.object({
    bookingId: z.string().max(MAX_ID).nullable().describe("The booking, as given."),
    result: z
        .enum(["confirmed", "declined", "settled"])
        .describe("`confirmed` once the booking is confirmed; `declined` when a person declined it; `settled` when nothing was to confirm."),
})

/** The booking of the examples: requested by Hoa for Monday 16 November, 09:00 in Ho Chi Minh City. */
const REQUESTED = {
    customerName: "Hoa",
    customerPhone: null,
    conversationId: "c1",
    serviceId: "s1",
    resourceId: "r1",
    startAt: "2026-11-16T02:00:00.000Z",
    endAt: "2026-11-16T03:00:00.000Z",
    blockEndAt: "2026-11-16T03:00:00.000Z",
    partySize: 1,
    status: "requested",
    note: "",
    remindedAt: null,
}

/**
 * `booking.confirm` (confirm the booking): its mode is `ask`: the owner approves the confirmation on a card in /chat, then the step
 * confirms the requested booking (`nivo.tool.record.update` to `confirmed`), its ONE write (rights rule 11e: one approval card asks for
 * one write). Telling the customer (`booking.confirm-tell`) and the team (`booking.confirm-notify`) are the next steps, each its own
 * write. A booking that is gone or no longer requested is `settled`; a declined card is a decision (`declined`), never a failure.
 * Change from the confirmation of `booking.book` version 3: the customer send and the team post left this step (same order of effects).
 */
export const bookingConfirmNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeBookingConfirmTitle"),
    description: {
        vi: "Sau khi b\u1ea1n duy\u1ec7t, x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n c\u1ee7a kh\u00e1ch (chuy\u1ec3n sang tr\u1ea1ng th\u00e1i \u0111\u00e3 x\u00e1c nh\u1eadn).",
        en: "Once you approve, confirms the customer's booking (its status becomes confirmed).",
    },
    tools: [],
    mode: "ask",
    accounts: [],
    input,
    output,
    routes: { by: "result", names: ["confirmed", "declined", "settled"] },
    run: async (given, context) => {
        const settled: ConfirmOutput = { bookingId: given.bookingId, result: "settled" }
        if (given.bookingId === null) return settled
        const booking = await bookingById(context, given.bookingId)
        if (booking?.values.status !== "requested") return settled
        const updated = await context.tools.call(TOOL.recordUpdate, {
            type: BOOKING_TYPES.booking,
            id: booking.id,
            patch: { status: "confirmed" },
            version: booking.version,
        })
        if (!updated.ok && updated.declined === true) return { bookingId: booking.id, result: "declined" }
        valueOrCannot(context, TOOL.recordUpdate, updated)
        return { bookingId: booking.id, result: "confirmed" }
    },
    examples: [
        {
            name: "confirms the requested booking once the owner approved",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", REQUESTED) }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: BOOKING_TYPES.booking, id: "b9", patch: { status: "confirmed" }, version: "1" },
                    answer: answered({ record: recordAnswer("b9", { ...REQUESTED, status: "confirmed" }) }),
                },
            ],
            output: { bookingId: "b9", result: "confirmed" },
        },
        {
            name: "the owner declined the confirmation on its card: nothing changes and nobody is told",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", REQUESTED) }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: BOOKING_TYPES.booking, id: "b9", patch: { status: "confirmed" }, version: "1" },
                    answer: refused("declined"),
                },
            ],
            output: { bookingId: "b9", result: "declined" },
        },
        {
            name: "a booking already confirmed or cancelled is settled",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", { ...REQUESTED, status: "cancelled" }) }),
                },
            ],
            output: { bookingId: "b9", result: "settled" },
        },
        {
            name: "no booking recorded: nothing to confirm",
            params: {},
            input: { bookingId: null },
            output: { bookingId: null, result: "settled" },
        },
        {
            name: "a booking that is gone is settled",
            params: {},
            input: { bookingId: "b9" },
            tools: [{ id: TOOL.recordGet, args: { type: BOOKING_TYPES.booking, id: "b9" }, answer: refused("not_found") }],
            output: { bookingId: "b9", result: "settled" },
        },
    ],
})
