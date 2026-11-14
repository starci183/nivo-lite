import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { BUSINESS_HOURS_SCOPE } from "../../entities/booking/hours.entity"
import {
    firstSlots,
    holdsResource,
    type DateException,
    type PlanInput,
    type TakenSpan,
    type WeeklyWindow,
} from "../../rules/booking"
import type { NodeSchema } from "../node-schema.types"
import { answered } from "../tool-answers"
import {
    BOOKING_TYPES,
    bookingRulesOf,
    bookingValues,
    hoursValues,
    listAll,
    recordAnswer,
    resourceValues,
    serviceValues,
    timeZoneOf,
} from "./booking.reads"

const ID = "booking.find-slots"

/** The most free start times offered per service. */
const SLOTS_PER_SERVICE = 6

/** What the step plans: from when (the run's instant when absent), over how many days, for one service or all, for how many people. */
export interface FindSlotsInput {
    /** The first instant to plan from (ISO 8601); the run's instant when null. */
    readonly fromAt?: string | null | undefined
    /** How many days ahead to plan. */
    readonly days: number
    /** Only this service; every active service when null. */
    readonly serviceId?: string | null | undefined
    /** How many customers come. */
    readonly partySize?: number | null | undefined
}

/** One free start time. */
export type OfferedSlot = {
    /** The start (ISO 8601). */
    readonly startAt: string
    /** The end of the visit (ISO 8601). */
    readonly endAt: string
    /** The end of the rest after it (ISO 8601). */
    readonly blockEndAt: string
    /** The resource that takes the visit. */
    readonly resourceId: string
}

/** One service with its earliest free start times. */
export type OfferedService = {
    /** The service id. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** How long a visit lasts, in minutes. */
    readonly durationMin: number
    /** Its price, in VND. */
    readonly priceVnd: number
    /** Its earliest free start times. */
    readonly slots: ReadonlyArray<OfferedSlot>
}

/** The services the shop takes bookings for, each with its earliest free start times, and the shop's time zone. */
export interface FindSlotsOutput {
    /** The shop's IANA time zone. */
    readonly timeZone: string
    /** Every active service with its earliest free start times. */
    readonly services: ReadonlyArray<OfferedService>
}

const input: NodeSchema<FindSlotsInput> = z.object({
    fromAt: z.string().max(40).nullish(),
    days: z.number().int().min(1).max(60),
    serviceId: z.string().max(MAX_ID).nullish(),
    partySize: z.number().int().min(1).max(100).nullish(),
})

const slotSchema = z.object({
    startAt: z.string().max(40),
    endAt: z.string().max(40),
    blockEndAt: z.string().max(40),
    resourceId: z.string().max(MAX_ID),
})

/** The shape of one offered service: what the booking step is given. */
export const offeredServiceSchema: NodeSchema<OfferedService> = z.object({
    id: z.string().max(MAX_ID),
    name: z.string().max(MAX_LINE),
    durationMin: z.number().int().positive(),
    priceVnd: z.number().min(0),
    slots: z.array(slotSchema).max(SLOTS_PER_SERVICE),
})

const output: NodeSchema<FindSlotsOutput> = z.object({
    timeZone: z.string().max(64).describe("The shop's IANA time zone."),
    services: z.array(offeredServiceSchema).max(50).describe("Every active service with its earliest free start times."),
})

const iso = (ms: number): string => new Date(ms).toISOString()

/**
 * `booking.find-slots` (find the free times): reads the calendar through the record tools (the active services and resources, the hours of
 * each resource and of the business, the bookings that already hold a resource in the window, the rules and the time zone) and answers
 * each service's earliest free start times by the pure availability rule (`rules/booking`). No model: exact code over records.
 */
export const bookingFindSlotsNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeBookingFindSlotsTitle"),
    description: { vi: "Xem l\u1ecbch v\u00e0 gi\u1edd l\u00e0m vi\u1ec7c \u0111\u1ec3 t\u00ecm nh\u1eefng gi\u1edd c\u00f2n tr\u1ed1ng s\u1edbm nh\u1ea5t cho t\u1eebng d\u1ecbch v\u1ee5.", en: "Checks the calendar and opening hours to find the earliest free times for each service." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const nowMs = Date.parse(context.run.at)
        const fromMs = given.fromAt === null || given.fromAt === undefined ? nowMs : Date.parse(given.fromAt)
        const toMs = fromMs + given.days * 86_400_000
        const rules = await bookingRulesOf(context)
        const timeZone = timeZoneOf()
        const services = await listAll(context, BOOKING_TYPES.service, serviceValues, {
            where: { op: "eq", field: "active", value: true },
            order: [["name", "asc"]],
        })
        const resources = await listAll(context, BOOKING_TYPES.resource, resourceValues, {
            where: { op: "eq", field: "active", value: true },
            order: [["sort", "asc"]],
        })
        const hours = await listAll(context, BOOKING_TYPES.hours, hoursValues, { order: [["scope", "asc"]] })
        const bookings = await listAll(context, BOOKING_TYPES.booking, bookingValues, {
            where: {
                op: "and",
                of: [
                    { op: "lt", field: "startAt", value: iso(toMs) },
                    { op: "gte", field: "startAt", value: iso(fromMs - 86_400_000) },
                ],
            },
            order: [["startAt", "asc"]],
        })
        const weekly: ReadonlyArray<WeeklyWindow> = hours.flatMap((one) =>
            one.values.resourceId === null
                ? []
                : one.values.calendar.weekly.map((w) => ({ resourceId: one.values.resourceId ?? "", ...w })),
        )
        const exceptions: ReadonlyArray<DateException> = hours.flatMap((one) =>
            one.values.calendar.exceptions.map((e) => ({
                ...e,
                resourceId: one.values.scope === BUSINESS_HOURS_SCOPE ? null : one.values.resourceId,
            })),
        )
        const taken: ReadonlyArray<TakenSpan> = bookings
            .filter((one) => holdsResource(one.values.status))
            .map((one) => ({
                id: one.id,
                resourceId: one.values.resourceId,
                startMs: Date.parse(one.values.startAt),
                blockEndMs: Date.parse(one.values.blockEndAt),
                partySize: one.values.partySize,
            }))
        const plan = (service: (typeof services)[number]): PlanInput => ({
            service: {
                id: service.id,
                durationMin: service.values.durationMin,
                bufferMin: service.values.bufferMin,
                resourceKind: service.values.resourceKind,
                active: service.values.active,
            },
            resources: resources.map((one) => ({ id: one.id, ...one.values })),
            hours: weekly,
            exceptions,
            taken,
            policy: { timeZone, slotStepMin: rules.slotStepMin, minLeadMin: rules.minLeadMin, maxAdvanceDays: rules.maxAdvanceDays },
            nowMs,
            partySize: given.partySize ?? 1,
        })
        const wanted = services.filter((one) => given.serviceId === null || given.serviceId === undefined || one.id === given.serviceId)
        return {
            timeZone,
            services: wanted.map((service) => ({
                id: service.id,
                name: service.values.name,
                durationMin: service.values.durationMin,
                priceVnd: service.values.priceVnd,
                slots: firstSlots(plan(service), fromMs, toMs, SLOTS_PER_SERVICE).map((slot) => ({
                    startAt: iso(slot.startMs),
                    endAt: iso(slot.endMs),
                    blockEndAt: iso(slot.blockEndMs),
                    resourceId: slot.resourceId,
                })),
            })),
        }
    },
    examples: [
        {
            name: "offers the earliest free start times of each active service, leaving out the one a booking holds",
            params: {},
            input: { days: 1 },
            // Monday 2026-11-16, 06:00 in Ho Chi Minh City (UTC+7).
            at: "2026-11-15T23:00:00.000Z",
            tools: [
                { id: TOOL.recordList, args: { type: BOOKING_TYPES.settings, limit: 1 }, answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [
                            recordAnswer("s1", {
                                name: "Head spa",
                                durationMin: 60,
                                bufferMin: 0,
                                priceVnd: 150_000,
                                resourceKind: null,
                                active: true,
                            }),
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [recordAnswer("r1", { name: "Lan", kind: "person", capacity: 1, active: true, sort: 0 })],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [
                            recordAnswer("h1", {
                                scope: "r1",
                                resourceId: "r1",
                                calendar: { weekly: [{ weekday: 1, start: "09:00", end: "12:00" }], exceptions: [] },
                            }),
                        ],
                        next: null,
                    }),
                },
                {
                    id: TOOL.recordList,
                    answer: answered({
                        records: [
                            recordAnswer("b1", {
                                customerName: "Minh",
                                customerPhone: null,
                                conversationId: null,
                                serviceId: "s1",
                                resourceId: "r1",
                                startAt: "2026-11-16T03:00:00.000Z",
                                endAt: "2026-11-16T04:00:00.000Z",
                                blockEndAt: "2026-11-16T04:00:00.000Z",
                                partySize: 1,
                                status: "confirmed",
                                note: "",
                                remindedAt: null,
                            }),
                        ],
                        next: null,
                    }),
                },
            ],
            output: {
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
                            {
                                startAt: "2026-11-16T04:00:00.000Z",
                                endAt: "2026-11-16T05:00:00.000Z",
                                blockEndAt: "2026-11-16T05:00:00.000Z",
                                resourceId: "r1",
                            },
                        ],
                    },
                ],
            },
        },
    ],
})
