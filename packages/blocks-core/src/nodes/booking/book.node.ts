import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { customerSend } from "../chatbot/front-desk.fixtures"
import { type ThreadFact, recentLinesSchema, threadLinesOf } from "../chatbot/front-desk.reads"
import type { NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"
import { sayToCustomer, saidOrCannot } from "../say-to-customer"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { BOOKING_TYPES, recordAnswer } from "./booking.reads"
import { type OfferedService, offeredServiceSchema } from "./find-slots.node"

const ID = "booking.book"

/** What the booking step works on: the customer's conversation and words, the customer when known, the free times on offer. */
export interface BookInput {
    /** The conversation the customer writes in: the reply goes there. */
    readonly conversationId: string
    /** What the customer said, one message per line. */
    readonly text: string
    /** The core contact of the customer, when the engine met them; the booking is written with it. */
    readonly contactId?: string | null | undefined
    /** The recent lines of the conversation the front desk handed on, oldest first (the conversation read is the owning agent's); none when the caller gave none. */
    readonly recentLines?: ReadonlyArray<ThreadFact> | null | undefined
    /** The customer's newest message, the one the booking's own wait took (from the second round of the talk on); null in the first round, which reads `text`. */
    readonly latest?: string | null | undefined
    /** The conversation as the round before carried it (its `transcript`); null in the first round, which reads the hand-off's recent lines. */
    readonly history?: ReadonlyArray<string> | null | undefined
    /** The shop's time zone, to read and say the times. */
    readonly timeZone: string
    /** The services with their earliest free start times (`booking.find-slots`). */
    readonly services: ReadonlyArray<OfferedService>
}

/** What the booking step did. */
export interface BookOutput {
    /**
     * `asked` the reply asks the customer for what is missing; `booked` the booking was recorded as requested; `declined` a person
     * declined the booking's record or the reply on its card (the graph tells the team and ends `declined`); `off` the customer's message is
     * not about a booking (the model's judgement; nothing is sent or recorded: the graph gives the message back, R33).
     */
    readonly branch: "asked" | "booked" | "declined" | "off"
    /** The booking recorded, on `booked`; else null. */
    readonly bookingId: string | null
    /** True when a person declined the booking's record or the reply on its card: that write was not done. */
    readonly declined: boolean
    /** The conversation as this step saw it, ending with the customer's message and the reply it sent: the next round of the talk reads it. */
    readonly transcript: ReadonlyArray<string>
}

/** What the agent settles with the customer: the reply, and the booking once the customer chose. */
type Settled = {
    readonly reply: string | null
    readonly choice: {
        readonly serviceId: string
        readonly startAt: string
        readonly resourceId: string
        readonly customerName: string
        readonly customerPhone: string | null
        readonly partySize: number
        readonly note: string
    } | null
}

const TEXT_MAX = 8000
const MAX_TURNS = 3
/** The most lines a transcript carries from one round to the next (the newest kept). */
const TRANSCRIPT_MAX = 20
/** The longest line of a transcript. */
const TRANSCRIPT_LINE_MAX = 300
/** The most services the step is given. */
const MAX_SERVICES = 50

const input: NodeSchema<BookInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(TEXT_MAX),
    contactId: z.string().max(MAX_ID).nullish(),
    recentLines: recentLinesSchema.nullish(),
    latest: z.string().max(TEXT_MAX).nullish(),
    history: z.array(z.string().max(TRANSCRIPT_LINE_MAX + 20)).max(TRANSCRIPT_MAX).nullish(),
    timeZone: z.string().min(1).max(64),
    services: z.array(offeredServiceSchema).max(MAX_SERVICES),
})

const output: NodeSchema<BookOutput> = z.object({
    branch: z
        .enum(["asked", "booked", "declined", "off"])
        .describe("`booked` once the booking is recorded; `asked` while something is missing; `declined` when a person declined a write; `off` when the message is not about a booking."),
    bookingId: z.string().max(MAX_ID).nullable().describe("The booking recorded, on `booked`."),
    declined: z.boolean().describe("True when a person declined the booking's record or the reply on its card."),
    transcript: z
        .array(z.string().max(TRANSCRIPT_LINE_MAX + 20))
        .max(TRANSCRIPT_MAX)
        .describe("The conversation as the step saw it, with the customer's message and the reply sent: the next round reads it."),
})

/** One line of a transcript: who said it and the words, cut to the line bound (a format step: the speaker is the code's own). */
const lineOf = (who: "customer" | "shop", text: string): string => `${who}: ${text.trim().slice(0, TRANSCRIPT_LINE_MAX)}`

/** The transcript a round hands on: what it read, then the customer's message and, when one was sent, the reply; the newest lines kept. */
const transcriptOf = (conversation: ReadonlyArray<string>, message: string, reply: string | null): ReadonlyArray<string> =>
    [...conversation, lineOf("customer", message), ...(reply === null ? [] : [lineOf("shop", reply)])].slice(-TRANSCRIPT_MAX)

const settled: NodeSchema<Settled> = z.object({
    reply: z
        .string()
        .min(1)
        .max(MAX_BODY)
        .nullable()
        .describe("The one chat message for the customer; the step sends it. Null when the customer's message is not about a booking (nothing is sent)."),
    choice: z
        .object({
            serviceId: z.string().max(MAX_ID).describe("The id of the service chosen, one of the services given."),
            startAt: z.string().max(40).describe("The start time chosen, exactly one `startAt` of that service's slots."),
            resourceId: z.string().max(MAX_ID).describe("The `resourceId` of that slot."),
            customerName: z.string().min(1).max(MAX_LINE).describe("The name the customer gave."),
            customerPhone: z.string().max(40).nullable().describe("The phone the customer gave, or null."),
            partySize: z.number().int().min(1).max(100).describe("How many people come; 1 unless the customer said more."),
            note: z.string().max(2_000).describe("What the customer asked for beside the service; empty when nothing."),
        })
        .nullable()
        .describe("Null until the customer chose a service, one of its free times, and gave a name."),
}).refine((written) => written.reply !== null || written.choice === null, {
    message: "a booking chosen carries the reply that says it is noted",
})

const GUIDANCE =
    "Offer only the services and free times given (say the times in the shop's time zone); never invent another time. Ask for one " +
    "missing thing per message: the service, then the time, then the customer's name (and a phone when they want a call). Once all " +
    "are given, fill `choice` and write a reply that says the booking is noted and the shop will confirm it. When the customer's message is " +
    "about something other than a booking (judge what they mean, never single words), answer `reply` null and `choice` null: you send " +
    "nothing and the message goes back to the front desk."

/**
 * `booking.book` (book): the agent reads the recent lines the front desk handed on and settles a booking with the customer from the free times on offer: it
 * asks for what is missing, one thing per message, or, once the customer chose a service, one of its free times and gave a name,
 * records the booking as `requested` (`nivo.tool.record.create` on `blocks-core.booking.booking`). The choice is checked exactly against the slots
 * on offer: a time that is not one of them ends the step (`cannot`). The reply goes out once through the customer send. A person who
 * declines the record or the reply on its card made a decision (route `declined`, never a failure): a declined record sends nothing; a
 * declined reply keeps the booking recorded (`bookingId`) and the graph tells the team.
 */
export const bookingBookNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeBookingBookTitle"),
    description: { vi: "Trao \u0111\u1ed5i v\u1edbi kh\u00e1ch \u0111\u1ec3 ch\u1ecdn d\u1ecbch v\u1ee5 v\u00e0 gi\u1edd tr\u1ed1ng, r\u1ed3i ghi l\u1ecbch h\u1eb9n \u1edf tr\u1ea1ng th\u00e1i ch\u1edd x\u00e1c nh\u1eadn v\u00e0 nh\u1eafn l\u1ea1i cho kh\u00e1ch.", en: "Talks with the customer to pick a service and a free time, records the booking as requested and replies to the customer." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    routes: { by: "branch", names: ["asked", "booked", "declined", "off"] },
    run: async (given, context) => {
        // The thread: what the round before carried (the booking talks over several messages in one run), else the lines the front desk
        // handed on, none when it handed none; the message: the one the booking's wait took, else the words of the hand-off.
        const conversation = given.history ?? threadLinesOf(given.recentLines ?? [])
        const message = given.latest ?? given.text
        const { reply, choice } = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: {
                message,
                conversation: [...conversation],
                timeZone: given.timeZone,
                services: given.services.map((service) => ({ ...service, slots: [...service.slots] })),
            },
            output: settled,
            tools: [],
            maxTurns: MAX_TURNS,
        })
        // Not about a booking: nothing is sent or recorded; the transcript carries on without the message (the graph hands it back).
        if (reply === null) return { branch: "off", bookingId: null, declined: false, transcript: [...conversation].slice(-TRANSCRIPT_MAX) }
        let bookingId: string | null = null
        if (choice !== null) {
            const slot = given.services
                .find((service) => service.id === choice.serviceId)
                ?.slots.find((one) => one.startAt === choice.startAt && one.resourceId === choice.resourceId)
            if (slot === undefined) return context.fail({ kind: "cannot", why: "the chosen time is not one of the free times on offer" })
            const created = await context.tools.call(TOOL.recordCreate, {
                type: BOOKING_TYPES.booking,
                values: {
                    customerName: choice.customerName,
                    customerPhone: choice.customerPhone,
                    contactId: given.contactId ?? null,
                    conversationId: given.conversationId,
                    serviceId: choice.serviceId,
                    resourceId: slot.resourceId,
                    startAt: slot.startAt,
                    endAt: slot.endAt,
                    blockEndAt: slot.blockEndAt,
                    partySize: choice.partySize,
                    status: "requested",
                    note: choice.note,
                },
            })
            if (!created.ok && created.declined === true)
                return { branch: "declined", bookingId: null, declined: true, transcript: transcriptOf(conversation, message, null) }
            const record = z.object({ record: z.object({ id: z.string().max(MAX_ID) }) }).parse(valueOrCannot(context, TOOL.recordCreate, created))
            bookingId = record.record.id
        }
        const said = await sayToCustomer(context, { text: reply })
        if (!said.ok && said.declined) return { branch: "declined", bookingId, declined: true, transcript: transcriptOf(conversation, message, null) }
        saidOrCannot(context, said)
        return { branch: bookingId === null ? "asked" : "booked", bookingId, declined: false, transcript: transcriptOf(conversation, message, reply) }
    },
    examples: [
        {
            name: "asks for the time while the customer has only named the service",
            params: {},
            input: {
                conversationId: "c1",
                text: "I would like to book a head spa",
                timeZone: "Asia/Ho_Chi_Minh",
                services: [
                    {
                        id: "s1",
                        name: "Head spa",
                        durationMin: 60,
                        priceVnd: 150_000,
                        slots: [
                            {
                                startAt: "2026-11-16T02:00:00.000Z",
                                endAt: "2026-11-16T03:00:00.000Z",
                                blockEndAt: "2026-11-16T03:00:00.000Z",
                                resourceId: "r1",
                            },
                        ],
                    },
                ],
            },
            tools: [customerSend("Would 9:00 on Monday 16/11 suit you?")],
            agent: [{ answer: { reply: "Would 9:00 on Monday 16/11 suit you?", choice: null } }],
            output: {
                branch: "asked",
                bookingId: null,
                declined: false,
                transcript: ["customer: I would like to book a head spa", "shop: Would 9:00 on Monday 16/11 suit you?"],
            },
        },
        {
            name: "records the booking as requested once the customer chose a free time and gave a name",
            params: {},
            input: {
                conversationId: "c1",
                text: "9:00 is fine, my name is Hoa",
                contactId: "c0",
                timeZone: "Asia/Ho_Chi_Minh",
                services: [
                    {
                        id: "s1",
                        name: "Head spa",
                        durationMin: 60,
                        priceVnd: 150_000,
                        slots: [
                            {
                                startAt: "2026-11-16T02:00:00.000Z",
                                endAt: "2026-11-16T03:00:00.000Z",
                                blockEndAt: "2026-11-16T03:00:00.000Z",
                                resourceId: "r1",
                            },
                        ],
                    },
                ],
            },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: BOOKING_TYPES.booking,
                        values: {
                            customerName: "Hoa",
                            customerPhone: null,
                            contactId: "c0",
                            conversationId: "c1",
                            serviceId: "s1",
                            resourceId: "r1",
                            startAt: "2026-11-16T02:00:00.000Z",
                            endAt: "2026-11-16T03:00:00.000Z",
                            blockEndAt: "2026-11-16T03:00:00.000Z",
                            partySize: 1,
                            status: "requested",
                            note: "",
                        },
                    },
                    answer: answered({ record: recordAnswer("b9", { status: "requested" }) }),
                },
                customerSend("We have noted 9:00 on Monday 16/11 for you, Hoa; we will confirm shortly."),
            ],
            agent: [
                {
                    answer: {
                        reply: "We have noted 9:00 on Monday 16/11 for you, Hoa; we will confirm shortly.",
                        choice: {
                            serviceId: "s1",
                            startAt: "2026-11-16T02:00:00.000Z",
                            resourceId: "r1",
                            customerName: "Hoa",
                            customerPhone: null,
                            partySize: 1,
                            note: "",
                        },
                    },
                },
            ],
            output: {
                branch: "booked",
                bookingId: "b9",
                declined: false,
                transcript: ["customer: 9:00 is fine, my name is Hoa", "shop: We have noted 9:00 on Monday 16/11 for you, Hoa; we will confirm shortly."],
            },
        },
        {
            name: "a time that is not on offer ends the step, nothing is recorded or sent",
            params: {},
            input: { conversationId: "c1", text: "Make it 8 in the evening", timeZone: "Asia/Ho_Chi_Minh", services: [] },
            tools: [],
            agent: [
                {
                    answer: {
                        reply: "We have noted 8 in the evening.",
                        choice: {
                            serviceId: "s1",
                            startAt: "2026-11-16T13:00:00.000Z",
                            resourceId: "r1",
                            customerName: "Hoa",
                            customerPhone: null,
                            partySize: 1,
                            note: "",
                        },
                    },
                },
            ],
            failure: { kind: "cannot", why: "the chosen time is not one of the free times on offer" },
        },
        {
            name: "a person declined the reply on its card: a decision, nothing sent",
            params: {},
            input: { conversationId: "c1", text: "I would like to book", timeZone: "Asia/Ho_Chi_Minh", services: [] },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: "We have no free time at the moment." },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { reply: "We have no free time at the moment.", choice: null } }],
            output: { branch: "declined", bookingId: null, declined: true, transcript: ["customer: I would like to book"] },
        },
        {
            name: "a later round reads the newest message against the transcript the round before carried",
            params: {},
            input: {
                conversationId: "c1",
                text: "I would like to book a head spa",
                latest: "9:00 is fine",
                history: ["customer: I would like to book a head spa", "shop: Would 9:00 on Monday 16/11 suit you?"],
                timeZone: "Asia/Ho_Chi_Minh",
                services: [],
            },
            tools: [customerSend("Lovely; may I have your name?")],
            agent: [{ answer: { reply: "Lovely; may I have your name?", choice: null } }],
            output: {
                branch: "asked",
                bookingId: null,
                declined: false,
                transcript: [
                    "customer: I would like to book a head spa",
                    "shop: Would 9:00 on Monday 16/11 suit you?",
                    "customer: 9:00 is fine",
                    "shop: Lovely; may I have your name?",
                ],
            },
        },
        {
            name: "a person declined recording the booking on its card: a decision, nothing recorded or sent",
            params: {},
            input: {
                conversationId: "c1",
                text: "9:00 is fine, my name is Hoa",
                timeZone: "Asia/Ho_Chi_Minh",
                services: [
                    {
                        id: "s1",
                        name: "Head spa",
                        durationMin: 60,
                        priceVnd: 150_000,
                        slots: [
                            {
                                startAt: "2026-11-16T02:00:00.000Z",
                                endAt: "2026-11-16T03:00:00.000Z",
                                blockEndAt: "2026-11-16T03:00:00.000Z",
                                resourceId: "r1",
                            },
                        ],
                    },
                ],
            },
            tools: [
                {
                    id: TOOL.recordCreate,
                    args: {
                        type: BOOKING_TYPES.booking,
                        values: {
                            customerName: "Hoa",
                            customerPhone: null,
                            contactId: null,
                            conversationId: "c1",
                            serviceId: "s1",
                            resourceId: "r1",
                            startAt: "2026-11-16T02:00:00.000Z",
                            endAt: "2026-11-16T03:00:00.000Z",
                            blockEndAt: "2026-11-16T03:00:00.000Z",
                            partySize: 1,
                            status: "requested",
                            note: "",
                        },
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [
                {
                    answer: {
                        reply: "We have noted 9:00 on Monday 16/11 for you, Hoa; we will confirm shortly.",
                        choice: {
                            serviceId: "s1",
                            startAt: "2026-11-16T02:00:00.000Z",
                            resourceId: "r1",
                            customerName: "Hoa",
                            customerPhone: null,
                            partySize: 1,
                            note: "",
                        },
                    },
                },
            ],
            output: { branch: "declined", bookingId: null, declined: true, transcript: ["customer: 9:00 is fine, my name is Hoa"] },
        },
    ],
})
