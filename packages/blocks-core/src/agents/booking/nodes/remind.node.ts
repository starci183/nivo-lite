import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type NodeContext, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import { reminderDue } from "../rules"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { nodeGoalOf } from "../../../shared/nodes/node-ui"
import { sayToCustomer } from "../../../shared/customer-chat/say-to-customer"
import { answered, refused, sentAnswer } from "../../../shared/nodes/tool-answers"
import {
    BOOKING_TYPES,
    type BookingValues,
    type ReadRecord,
    bookingRulesOf,
    bookingValues,
    listAll,
    recordAnswer,
    timeZoneOf,
} from "./booking.reads"

const ID = "booking.remind"

/** What the clock gives the reminder round: the slot it fired for (absent for a person's "run now"). */
export interface RemindInput {
    /** The clock's slot, epoch milliseconds; the run's instant when absent. */
    readonly slotMs?: number | null | undefined
}

/** What the round did. */
export interface RemindOutput {
    /** The bookings whose customer was reminded. */
    readonly reminded: number
    /** The bookings due a reminder that came in no conversation (booked by the team): nobody to write to. */
    readonly skipped: number
    /** The bookings whose reminder the send refused. */
    readonly refused: number
}

const input: NodeSchema<RemindInput> = z.object({ slotMs: z.number().int().positive().nullish() })

const output: NodeSchema<RemindOutput> = z.object({
    reminded: z.number().int().min(0).describe("How many customers were reminded."),
    skipped: z.number().int().min(0).describe("Bookings due a reminder with no conversation to write in."),
    refused: z.number().int().min(0).describe("Reminders the send refused."),
})

const reminder = z.object({ text: z.string().min(1).max(MAX_BODY).describe("One friendly reminder of the booking.") })

const GUIDANCE =
    "Say the time in the shop's time zone, never in UTC. One short, friendly line; ask the customer to tell the shop if they cannot come."

/** The confirmed booking of the examples: Hoa, Monday 16 November 09:00 in Ho Chi Minh City. */
const CONFIRMED = {
    customerName: "Hoa",
    customerPhone: null,
    conversationId: "c1",
    serviceId: "s1",
    resourceId: "r1",
    startAt: "2026-11-16T02:00:00.000Z",
    endAt: "2026-11-16T03:00:00.000Z",
    blockEndAt: "2026-11-16T03:00:00.000Z",
    partySize: 1,
    status: "confirmed",
    note: "",
    remindedAt: null,
}

const REMINDER = "A friendly reminder, Hoa: your head spa is tomorrow (Monday 16/11) at 9:00. Tell us if you cannot come!"

/** The counts of a round so far. */
type Counts = RemindOutput

/** The bookings from `index` on, reminded one after the other (each send is its own effect), added to `counts`. */
const remindFrom = async (
    context: NodeContext,
    due: ReadonlyArray<ReadRecord<BookingValues>>,
    timeZone: string,
    index: number,
    counts: Counts,
): Promise<Counts> => {
    const booking = due[index]
    if (booking === undefined) return counts
    const conversationId = booking.values.conversationId
    if (conversationId === null) return remindFrom(context, due, timeZone, index + 1, { ...counts, skipped: counts.skipped + 1 })
    const { text } = await context.agent.run({
        goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
        input: { timeZone, booking: { ...booking.values } },
        output: reminder,
        tools: [],
        maxTurns: 1,
    })
    const said = await sayToCustomer(context, { text })
    if (!said.ok) return remindFrom(context, due, timeZone, index + 1, { ...counts, refused: counts.refused + 1 })
    await context.tools.call(TOOL.recordUpdate, { type: BOOKING_TYPES.booking, id: booking.id, patch: { remindedAt: context.run.at } })
    return remindFrom(context, due, timeZone, index + 1, { ...counts, reminded: counts.reminded + 1 })
}

/**
 * `booking.remind` (Nhac lich): on each clock tick, the confirmed bookings that start within the workspace's reminder window and were
 * not reminded yet (`rules/booking` `reminderDue`) get one reminder each: the agent writes it, the step sends it in the customer's
 * conversation and marks the booking reminded (`remindedAt`), so a later tick never reminds twice. A booking that came in no
 * conversation is counted as skipped; a refused send is counted, never tried another way.
 */
export const bookingRemindNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeBookingRemindTitle"),
    description: { vi: "Nh\u1eafc kh\u00e1ch m\u1ed9t l\u1ea7n tr\u01b0\u1edbc gi\u1edd h\u1eb9n \u0111\u00e3 x\u00e1c nh\u1eadn v\u00e0 ghi nh\u1eadn \u0111\u00e3 nh\u1eafc \u0111\u1ec3 kh\u00f4ng nh\u1eafc l\u1ea1i.", en: "Reminds each customer once before a confirmed booking and marks it reminded so it is never repeated." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const nowMs = given.slotMs ?? Date.parse(context.run.at)
        const rules = await bookingRulesOf(context)
        const timeZone = timeZoneOf()
        const ahead = await listAll(context, BOOKING_TYPES.booking, bookingValues, {
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "status", value: "confirmed" },
                    { op: "gt", field: "startAt", value: new Date(nowMs).toISOString() },
                    { op: "lte", field: "startAt", value: new Date(nowMs + rules.remindHoursBefore * 3_600_000).toISOString() },
                ],
            },
            order: [["startAt", "asc"]],
        })
        const due = ahead.filter((one) =>
            reminderDue({ ...one.values, startMs: Date.parse(one.values.startAt) }, nowMs, rules.remindHoursBefore),
        )
        return remindFrom(context, due, timeZone, 0, { reminded: 0, skipped: 0, refused: 0 })
    },
    examples: [
        {
            name: "reminds the confirmed booking of tomorrow morning once and marks it reminded",
            params: {},
            input: {},
            // Sunday 15 November, 10:00 in Ho Chi Minh City: the booking starts within 24 hours.
            at: "2026-11-15T03:00:00.000Z",
            tools: [
                { id: TOOL.recordList, args: { type: BOOKING_TYPES.settings, limit: 1 }, answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [recordAnswer("b9", CONFIRMED), recordAnswer("b10", { ...CONFIRMED, conversationId: null })],
                        next: null,
                    }),
                },
                { id: TOOL.customerMessageSend, args: { text: REMINDER }, answer: sentAnswer("m1", "route-1") },
                {
                    id: TOOL.recordUpdate,
                    args: { type: BOOKING_TYPES.booking, id: "b9", patch: { remindedAt: "2026-11-15T03:00:00.000Z" } },
                    answer: answered({ record: recordAnswer("b9", { ...CONFIRMED, remindedAt: "2026-11-15T03:00:00.000Z" }) }),
                },
            ],
            agent: [{ answer: { text: REMINDER } }],
            output: { reminded: 1, skipped: 1, refused: 0 },
        },
        {
            name: "a booking already reminded gets nothing, and a refused send is counted",
            params: {},
            input: {},
            at: "2026-11-15T03:00:00.000Z",
            tools: [
                { id: TOOL.recordList, args: { type: BOOKING_TYPES.settings, limit: 1 }, answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [
                            recordAnswer("b9", { ...CONFIRMED, remindedAt: "2026-11-14T03:00:00.000Z" }),
                            recordAnswer("b10", CONFIRMED),
                        ],
                        next: null,
                    }),
                },
                { id: TOOL.customerMessageSend, args: { text: REMINDER }, answer: refused("outside_window") },
            ],
            agent: [{ answer: { text: REMINDER } }],
            output: { reminded: 0, skipped: 0, refused: 1 },
        },
    ],
})
