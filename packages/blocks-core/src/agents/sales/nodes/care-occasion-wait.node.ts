import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { ARMED, CARE_OPEN, EXAMPLE_AT } from "./care.examples"
import { isDue, occasionStandingOf, type OccasionStanding } from "./care.policy"
import { RECENT_ORDERS_MAX, careFactsOf, itemsLineOf, lastPaidOrderOf } from "./care.reads"
import { armCare, careTimerArgsOf } from "./care.steps"
import { answered, contextAnswer, refused } from "../../../shared/nodes/tool-answers"

/** The routes of the occasion wait: write now, the timer moved, nothing to do, or a person declined moving the timer. */
export const OCCASION_WAIT_ROUTES = ["due", "later", "closed", "declined"] as const

/** What the occasion wait is given: the timer that woke it. */
export interface CareOccasionWaitInput {
    /** The customer (`= trigger.ref`). */
    readonly leadId: string
    /** The occasion among the customer's (`= trigger.item`), or null when the timer names none (then there is nothing to write about). */
    readonly occasionId: string | null
    /**
     * The moment the run is due (`= trigger.dueAt`), or null. A timer's own wake carries the moment it was armed for, which the date
     * already reaches; "run now" from the schedule carries the press moment, so the step writes although the date is still ahead.
     */
    readonly dueAt: string | null
}

/** The customer's last paid order, as far as a suggestion needs it. */
type LastOrder = {
    /** The order number. */
    readonly orderNo: string
    /** The items, as one line of text. */
    readonly items: string
}

/** The occasion the suggestion is about, handed on when it is due. */
export interface OccasionDue {
    /** The occasion's id (the timer's item, for the re-arm). */
    readonly occasionId: string
    /** What it is, in the customer's words. */
    readonly label: string
    /** The month, the day, and the year of a one-off (null for a yearly date): what the re-arm counts from. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
    /** The year of a one-off date, or null for a yearly one. */
    readonly year: number | null
    /** The instant (Vietnam midnight) of the occurrence being handled. */
    readonly on: string
    /** Who the purchase is for, as the customer said, or null. */
    readonly recipient: string | null
    /** The customer's last paid order: what to suggest something like. */
    readonly lastOrder: LastOrder
}

/** Where the occasion stands. */
export interface CareOccasionWaitOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** `due` write now; `later` the timer moved to the lead time; `closed` nothing to do (no such date, gone, opted out, no paid order); `declined` a person declined moving the timer on its card. */
    readonly route: (typeof OCCASION_WAIT_ROUTES)[number]
    /** The occasion to write about, on `due`; null otherwise. */
    readonly due: OccasionDue | null
}

/** What the owner sets for the occasion step. */
export interface CareOccasionWaitParams {
    /** How many days before a date the customer mentioned the shop writes. */
    readonly occasionLeadDays: number
}

const params: NodeSchema<CareOccasionWaitParams, { occasionLeadDays?: number | undefined }> = z.object({
    occasionLeadDays: z.number().int().min(1).max(30).default(7),
})

const input: NodeSchema<CareOccasionWaitInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    occasionId: z.string().max(MAX_ID).min(1).nullable(),
    dueAt: z.string().max(40).nullable(),
})

/** The occasion handed on, as a schema (the send and the re-arm read it). */
export const occasionDueSchema: NodeSchema<OccasionDue> = z.object({
    occasionId: z.string().max(MAX_ID),
    label: z.string().max(MAX_LINE),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    year: z.number().int().nullable(),
    on: z.string().max(40),
    recipient: z.string().max(MAX_LINE).nullable(),
    lastOrder: z.object({ orderNo: z.string().max(MAX_LINE), items: z.string().max(MAX_LINE) }),
})

const output: NodeSchema<CareOccasionWaitOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    route: z.enum(OCCASION_WAIT_ROUTES).describe("`due` write now; `later` the timer moved; `closed` nothing to do; `declined` a person declined moving the timer."),
    due: occasionDueSchema.nullable().describe("The occasion to write about, on `due`; null otherwise."),
})

/** The latest orders of `l1` in the examples: one paid order of roses. */
const ORDERS_PAID = contextAnswer("nivo.lead", [
    { id: "o1", orderNo: "DH-1", status: "paid", items: [{ name: "roses", qty: 1 }] },
])

/**
 * Where the date stands for this run: the clock's standing, except that a run whose own due moment has come (a forced "run now" from the
 * schedule) treats a date still ahead as due.
 */
const standingFor = (standing: OccasionStanding, dueAt: string | null, at: string): OccasionStanding =>
    standing.kind === "later" && dueAt !== null && isDue(dueAt, at) ? { kind: "due", on: standing.on } : standing

/**
 * `sales.care-occasion-wait` (Cho den dip): exact timing, so code, no AI. Woken by the occasion timer, it finds the occasion by its id in
 * `nivo.tool.lead.care.get` and routes: `later` (still before the lead time: ONE re-arm to `occasionLeadDays` before it), `due` (inside
 * the lead time, or "run now"), `closed` (no such date, a one-off that passed, opted out, or no paid order to suggest something like:
 * `nivo.tool.lead.order.list`).
 */
export const salesCareOccasionWaitNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: "sales.care-occasion-wait",
    title: { key: "nodeSalesCareOccasionWaitTitle" },
    description: { vi: "Ch\u1edd \u0111\u1ebfn g\u1ea7n d\u1ecbp c\u1ee7a kh\u00e1ch (sinh nh\u1eadt, k\u1ef7 ni\u1ec7m) r\u1ed3i m\u1edbi g\u1ee3i \u00fd; ch\u01b0a t\u1edbi th\u00ec h\u1eb9n l\u1ea1i, kh\u00f4ng c\u00f2n d\u1ecbp ho\u1eb7c kh\u00e1ch t\u1eeb ch\u1ed1i th\u00ec d\u1eebng.", en: "Waits until a customer's occasion (birthday, anniversary) is near before suggesting anything: books it again if early, and stops if the date is gone or the customer opted out." },
    tools: [TOOL.leadCareGet, TOOL.leadOrderList],
    mode: "auto",
    accounts: [],
    input,
    output,
    params,
    routes: { by: "route", names: OCCASION_WAIT_ROUTES },
    run: async (given, context) => {
        const closed: CareOccasionWaitOutput = { leadId: given.leadId, route: "closed", due: null }
        if (given.occasionId === null) return closed
        const at = context.run.at
        const facts = await careFactsOf(context, given.leadId)
        const occasion = facts?.occasions.find((one) => one.occasionId === given.occasionId)
        if (facts === null || facts.optedOut || occasion === undefined) return closed
        const standing = standingFor(occasionStandingOf(occasion, at, context.params.occasionLeadDays), given.dueAt, at)
        if (standing.kind === "gone") return closed
        if (standing.kind === "later") {
            const move = await armCare(context, {
                kind: "occasion",
                ref: given.leadId,
                item: occasion.occasionId,
                dueAt: standing.writeAt,
            })
            return { leadId: given.leadId, route: move.declined ? "declined" : "later", due: null }
        }
        const last = await lastPaidOrderOf(context)
        if (last === null) return closed
        return {
            leadId: given.leadId,
            route: "due",
            due: {
                ...occasion,
                on: standing.on,
                recipient: facts.recipient,
                lastOrder: { orderNo: last.orderNo, items: itemsLineOf(last.items) },
            },
        }
    },
    examples: [
        {
            name: "inside the lead time of a birthday the suggestion is due, about the last paid order",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(1, 5) },
                { id: TOOL.leadOrderList, args: { limit: RECENT_ORDERS_MAX }, answer: ORDERS_PAID },
            ],
            output: { leadId: "l1", route: "due", due: dueOf(1, 5, "1970-01-04T17:00:00.000Z") },
        },
        {
            name: "a date still far away moves the timer to the lead time and nothing is written",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(6, 1) },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-05-24T17:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { leadId: "l1", route: "later", due: null },
        },
        {
            name: "run now from the schedule: a date still far away is due at once",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: "1970-01-01T00:00:00.000Z" },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(6, 1) },
                { id: TOOL.leadOrderList, args: { limit: RECENT_ORDERS_MAX }, answer: ORDERS_PAID },
            ],
            output: { leadId: "l1", route: "due", due: dueOf(6, 1, "1970-05-31T17:00:00.000Z") },
        },
        {
            name: "a customer who asked to be left alone gets no suggestion",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                {
                    id: TOOL.leadCareGet,
                    args: { leadId: "l1" },
                    answer: answered({ ...CARE_OPEN, optedOut: true, occasions: [occasionOf(1, 5)] }),
                },
            ],
            output: { leadId: "l1", route: "closed", due: null },
        },
        {
            name: "a customer with no paid order has nothing to order again",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(1, 5) },
                {
                    id: TOOL.leadOrderList,
                    args: { limit: RECENT_ORDERS_MAX },
                    answer: contextAnswer("nivo.lead", [{ id: "o2", orderNo: "DH-2", status: "confirmed", items: [] }]),
                },
            ],
            output: { leadId: "l1", route: "closed", due: null },
        },
        {
            name: "a timer that names no occasion has nothing to write about: it ends quietly, nothing read",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: null, dueAt: null },
            tools: [],
            output: { leadId: "l1", route: "closed", due: null },
        },
        {
            name: "a timer for a date the customer no longer has ends quietly",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-gone", dueAt: null },
            tools: [{ id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(1, 5) }],
            output: { leadId: "l1", route: "closed", due: null },
        },
        {
            name: "a move of the timer the schedule tool refuses ends the step, never reported as re-armed",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(6, 1) },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-05-24T17:00:00.000Z" }),
                    answer: refused("invalid_arguments"),
                },
            ],
            failure: { kind: "cannot", why: "nivo.tool.timer.arm refused: invalid_arguments" },
        },
        {
            name: "a person declines moving the timer: nothing is moved, nothing is written, the step routes declined",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1", occasionId: "occ-1", dueAt: null },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: careWith(6, 1) },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-05-24T17:00:00.000Z" }),
                    answer: refused("declined"),
                },
            ],
            output: { leadId: "l1", route: "declined", due: null },
        },
    ],
})

/** The occasion the example reads. */
type SampleOccasion = {
    readonly occasionId: string
    readonly label: string
    readonly month: number
    readonly day: number
    readonly year: null
}

/** The example occasion `occ-1`, a yearly birthday on a month and day. */
function occasionOf(month: number, day: number): SampleOccasion {
    return { occasionId: "occ-1", label: "birthday", month, day, year: null }
}

/** The care read of `l1` with the one birthday, the receiver "her". */
function careWith(month: number, day: number): ReturnType<typeof answered> {
    return answered({ ...CARE_OPEN, recipient: "her", occasions: [occasionOf(month, day)] })
}

/** What the wait hands on for the birthday on a month and day, falling on `on`. */
function dueOf(month: number, day: number, on: string): OccasionDue {
    return { ...occasionOf(month, day), on, recipient: "her", lastOrder: { orderNo: "DH-1", items: "1 x roses" } }
}
