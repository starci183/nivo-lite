import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"
import { sayToCustomer, saidOrCannot } from "../say-to-customer"
import { answered, refused, sentAnswer } from "../tool-answers"
import { BOOKING_TYPES, bookingById, recordAnswer } from "./booking.reads"

const ID = "booking.confirm-tell"

/** The booking the owner confirmed. */
export interface ConfirmTellInput {
    /** The booking `booking.confirm` confirmed (its output; never null on its `confirmed` route). */
    readonly bookingId: string | null
}

/** What the step said, and the words it wrote for the team. */
export interface ConfirmTellOutput {
    /** The booking, echoed. */
    readonly bookingId: string
    /** `told` the customer was told (or the booking has no conversation to tell); `declined` a person declined the send on its card. */
    readonly result: "told" | "declined"
    /** The heading of the team's notice, for `booking.confirm-notify`. */
    readonly teamTitle: string
    /** The words of the team's notice, for `booking.confirm-notify`. */
    readonly teamText: string
}

/** What the agent writes: the line to the customer and the notice to the team. */
type Written = {
    readonly customerText: string
    readonly teamTitle: string
    readonly teamText: string
}

const input: NodeSchema<ConfirmTellInput> = z.object({ bookingId: z.string().max(MAX_ID).nullable() })

const output: NodeSchema<ConfirmTellOutput> = z.object({
    bookingId: z.string().min(1).max(MAX_ID).describe("The booking, as given."),
    result: z.enum(["told", "declined"]).describe("`told` once the customer is told; `declined` when a person declined the send."),
    teamTitle: z.string().min(1).max(MAX_LINE).describe("The heading of the team's notice."),
    teamText: z.string().min(1).max(2_000).describe("The words of the team's notice."),
})

const written: NodeSchema<Written> = z.object({
    customerText: z.string().min(1).max(MAX_BODY).describe("One chat message that confirms the booking to the customer."),
    teamTitle: z.string().min(1).max(MAX_LINE).describe("A short heading for the team."),
    teamText: z.string().min(1).max(2_000).describe("Who booked, the service, the time in the shop's zone, the party."),
})

const GUIDANCE = "Say the time in the shop's time zone, never in UTC. Say only what the booking holds; never promise anything else."

/** The booking of the examples: confirmed for Hoa, Monday 16 November, 09:00 in Ho Chi Minh City. */
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

const CUSTOMER_TEXT = "Your booking is confirmed, Hoa: Monday 16/11 at 9:00. See you then!"
const TEAM = { teamTitle: "New booking", teamText: "Hoa, 9:00 Monday 16/11, 1 person." }

/**
 * `booking.confirm-tell` (tell the customer the booking is confirmed): after `booking.confirm` confirmed the booking, the agent writes
 * the confirmation for the customer and the notice for the team from the booking's own values, and the step sends the confirmation in
 * the customer's conversation (`nivo.tool.customer.message.send`, its ONE write). A booking with no conversation is told nobody here.
 * The team's words go on to `booking.confirm-notify`. A person who declines the send on its card is a decision (`declined`), never a
 * failure: the booking stays confirmed and the graph tells the team.
 */
export const bookingConfirmTellNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeBookingConfirmTellTitle"),
    description: {
        vi: "Vi\u1ebft l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n cho kh\u00e1ch v\u00e0 m\u1ed9t d\u00f2ng b\u00e1o cho \u0111\u1ed9i, r\u1ed3i nh\u1eafn l\u1eddi x\u00e1c nh\u1eadn cho kh\u00e1ch.",
        en: "Writes the booking confirmation for the customer and a line for the team, then sends the confirmation to the customer.",
    },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    routes: { by: "result", names: ["told", "declined"] },
    run: async (given, context) => {
        if (given.bookingId === null) return context.fail({ kind: "cannot", why: "no booking was confirmed to tell" })
        const booking = await bookingById(context, given.bookingId)
        if (booking === null) return context.fail({ kind: "cannot", why: `booking ${given.bookingId} is gone` })
        const words = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: { booking: { ...booking.values } },
            output: written,
            tools: [],
            maxTurns: 1,
        })
        const team = { teamTitle: words.teamTitle, teamText: words.teamText }
        if (booking.values.conversationId !== null) {
            const said = await sayToCustomer(context, { text: words.customerText })
            if (!said.ok && said.declined) return { bookingId: booking.id, result: "declined", ...team }
            saidOrCannot(context, said)
        }
        return { bookingId: booking.id, result: "told", ...team }
    },
    examples: [
        {
            name: "tells the customer the booking is confirmed and hands on the team's words",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", CONFIRMED) }),
                },
                {
                    id: TOOL.customerMessageSend,
                    args: { text: CUSTOMER_TEXT },
                    answer: sentAnswer("m1", "route-1"),
                },
            ],
            agent: [{ answer: { customerText: CUSTOMER_TEXT, ...TEAM } }],
            output: { bookingId: "b9", result: "told", ...TEAM },
        },
        {
            name: "a booking with no conversation: nobody to tell here, the team's words go on",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", { ...CONFIRMED, conversationId: null }) }),
                },
            ],
            agent: [{ answer: { customerText: CUSTOMER_TEXT, ...TEAM } }],
            output: { bookingId: "b9", result: "told", ...TEAM },
        },
        {
            name: "a person declined the send on its card: the customer is not told, the step says declined",
            params: {},
            input: { bookingId: "b9" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: BOOKING_TYPES.booking, id: "b9" },
                    answer: answered({ record: recordAnswer("b9", CONFIRMED) }),
                },
                {
                    id: TOOL.customerMessageSend,
                    args: { text: CUSTOMER_TEXT },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { customerText: CUSTOMER_TEXT, ...TEAM } }],
            output: { bookingId: "b9", result: "declined", ...TEAM },
        },
        {
            name: "a booking that is gone ends the step as cannot",
            params: {},
            input: { bookingId: "b9" },
            tools: [{ id: TOOL.recordGet, args: { type: BOOKING_TYPES.booking, id: "b9" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: "booking b9 is gone" },
        },
    ],
})
