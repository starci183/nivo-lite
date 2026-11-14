import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { DEFAULT_TIME_ZONE } from "../../../shared/entities/workspace/time-zone"
import { BOOKING_RULE_DEFAULTS } from "../rules/booking"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { valueOrCannot } from "../../../shared/nodes/tool-answers"

/*
 * The reads the booking nodes make through the generic record tools (`nivo.tool.record.list`, `nivo.tool.record.get`): every answer is
 * `{ records: [{ id, version, createdAt, updatedAt, values }], next }` or `{ record }`. Each schema below is the smallest shape a node
 * reads of a type's values; an answer without it is an integrity failure (`cannot`), never guessed around.
 */

const id = z.string().min(1).max(MAX_ID)
const text = z.string().max(MAX_LINE)
const time = z.string().min(1).max(40)
const clock = z.string().max(8)

/** The most records one page of the record list answers. */
const PAGE_SIZE = 50

/** The most pages of one list a node reads. */
const MAX_PAGES = 10

/** One record as the record tools answer it, its values still unread (an object the type schema reads next). */
const rawRecord = z.object({
    id,
    version: z.string().max(40),
    values: z.looseObject({}),
})

/** One record as the record tools answer it, before its values are read. */
type RawRecord = z.output<typeof rawRecord>

/** The record type of a booking, and of the other booking records. */
export const BOOKING_TYPES = {
    service: "blocks-core.booking.service",
    resource: "blocks-core.booking.resource",
    hours: "blocks-core.booking.hours",
    booking: "blocks-core.booking.booking",
    settings: "blocks-core.booking.settings",
} as const

/** A service as the nodes read it. */
export type ServiceValues = {
    /** The name the customer books it by. */
    readonly name: string
    /** How long a visit lasts, in minutes. */
    readonly durationMin: number
    /** The rest after a visit while the resource stays blocked, in minutes. */
    readonly bufferMin: number
    /** The price, in VND. */
    readonly priceVnd: number
    /** The kind of resource the service needs (`person`, `room`), or null for any. */
    readonly resourceKind: string | null
    /** Whether the service takes bookings. */
    readonly active: boolean
}

/** A resource as the nodes read it. */
export type ResourceValues = {
    /** The name shown to people. */
    readonly name: string
    /** What it is: `person` or `room`. */
    readonly kind: string
    /** How many customers it serves at once. */
    readonly capacity: number
    /** Whether it takes bookings. */
    readonly active: boolean
    /** Its order on the calendar. */
    readonly sort: number
}

/** One weekly opening window, as the nodes read it. */
export type ReadWindow = {
    /** The ISO weekday, 1 is Monday. */
    readonly weekday: number
    /** The opening time, `HH:MM`. */
    readonly start: string
    /** The closing time, `HH:MM`. */
    readonly end: string
}

/** One date exception, as the nodes read it. */
export type ReadException = {
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** Whether the date is closed. */
    readonly closed: boolean
    /** The opening time of an open exception, `HH:MM`, or null. */
    readonly start: string | null
    /** The closing time of an open exception, `HH:MM`, or null. */
    readonly end: string | null
}

/** The calendar of a scope, as the nodes read it. */
export type ReadCalendar = {
    /** The weekly windows. */
    readonly weekly: ReadonlyArray<ReadWindow>
    /** The date exceptions. */
    readonly exceptions: ReadonlyArray<ReadException>
}

/** The hours of a scope as the nodes read them. */
export type HoursValues = {
    /** The scope: a resource id, or `business`. */
    readonly scope: string
    /** The resource, or null for the whole business. */
    readonly resourceId: string | null
    /** Its windows and exceptions. */
    readonly calendar: ReadCalendar
}

/** A booking as the nodes read it. */
export type BookingValues = {
    /** The name the customer booked under. */
    readonly customerName: string
    /** The phone the customer gave, or null. */
    readonly customerPhone: string | null
    /** The conversation the booking came in, or null when the team booked it. */
    readonly conversationId: string | null
    /** The service booked. */
    readonly serviceId: string
    /** The resource that serves it. */
    readonly resourceId: string
    /** The start (ISO 8601). */
    readonly startAt: string
    /** The end of the visit (ISO 8601). */
    readonly endAt: string
    /** The end of the rest after it (ISO 8601): the resource is free again. */
    readonly blockEndAt: string
    /** How many people come. */
    readonly partySize: number
    /** `requested`, `confirmed`, `cancelled` or `done`. */
    readonly status: string
    /** What the customer asked for beside the service. */
    readonly note: string
    /** When the one reminder went out (ISO 8601), or null. */
    readonly remindedAt: string | null
}

/** The rules of the calendar, the workspace's or the defaults. */
export type BookingRules = {
    /** The step between start times, in minutes. */
    readonly slotStepMin: number
    /** How soon a customer may book, in minutes from now. */
    readonly minLeadMin: number
    /** How far ahead a customer may book, in days. */
    readonly maxAdvanceDays: number
    /** How many hours before the start the reminder goes out. */
    readonly remindHoursBefore: number
}

/** The schema of a service's values. */
export const serviceValues: NodeSchema<ServiceValues> = z.object({
    name: text,
    durationMin: z.number().int().positive(),
    bufferMin: z.number().int().min(0),
    priceVnd: z.number().min(0),
    resourceKind: text.nullable(),
    active: z.boolean(),
})

/** The schema of a resource's values. */
export const resourceValues: NodeSchema<ResourceValues> = z.object({
    name: text,
    kind: text,
    capacity: z.number().int().positive(),
    active: z.boolean(),
    sort: z.number().int(),
})

/** The schema of the hours of a scope. */
export const hoursValues: NodeSchema<HoursValues> = z.object({
    scope: text,
    resourceId: id.nullable(),
    calendar: z.object({
        weekly: z.array(z.object({ weekday: z.number().int(), start: clock, end: clock })).max(MAX_ENTRIES),
        exceptions: z
            .array(z.object({ date: z.string().max(10), closed: z.boolean(), start: clock.nullable(), end: clock.nullable() }))
            .max(MAX_ENTRIES),
    }),
})

/** The schema of a booking's values. */
export const bookingValues: NodeSchema<BookingValues> = z.object({
    customerName: text,
    customerPhone: text.nullable(),
    conversationId: id.nullable(),
    serviceId: id,
    resourceId: id,
    startAt: time,
    endAt: time,
    blockEndAt: time,
    partySize: z.number().int().positive(),
    status: text,
    note: z.string().max(2_000),
    remindedAt: time.nullable(),
})

const settingsValues: NodeSchema<BookingRules> = z.object({
    slotStepMin: z.number().int().positive(),
    minLeadMin: z.number().int().min(0),
    maxAdvanceDays: z.number().int().positive(),
    remindHoursBefore: z.number().int().positive(),
})

/** The answer of one page of the record list. */
const pageSchema = z.object({ records: z.array(rawRecord).max(PAGE_SIZE), next: z.string().max(4_096).nullable() })

/** A record of a booking type: its id, version and the values a node reads. */
export type ReadRecord<V> = {
    /** The record id. */
    readonly id: string
    /** Its version, for an update at the version read. */
    readonly version: string
    /** The values the node reads. */
    readonly values: V
}

/** One page of a list, its records read. */
type ReadPage<V> = {
    /** The records of the page. */
    readonly records: ReadonlyArray<ReadRecord<V>>
    /** The cursor of the next page, or null on the last. */
    readonly next: string | null
}

/** The filter and the order of a list, as the record list takes them. */
export type ListQuery = {
    /** The filter on the type's own fields. */
    readonly where?: JsonValue
    /** The order, by declared fields. */
    readonly order?: JsonValue
}

/** The context a read uses: the tools, and the stop of the node. */
type ReadContext = Pick<NodeContext, "fail" | "tools">

/** One record of an answer with its values parsed by `values`, or the node stops. */
const recordOf = <V extends z.ZodType>(context: Pick<NodeContext, "fail">, tool: string, values: V, raw: RawRecord): ReadRecord<z.output<V>> => {
    const parsed = values.safeParse(raw.values)
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${tool} answered values of an unknown shape` })
    return { id: raw.id, version: raw.version, values: parsed.data }
}

/** The parsed answer of a list, or the node stops. */
const pageOf = <V extends z.ZodType>(context: Pick<NodeContext, "fail">, values: V, answer: JsonObject): ReadPage<z.output<V>> => {
    const parsed = pageSchema.safeParse(answer)
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${TOOL.recordList} answered an unknown shape` })
    return { records: parsed.data.records.map((raw) => recordOf(context, TOOL.recordList, values, raw)), next: parsed.data.next }
}

/** The pages from `cursor` on, one after the other, until the last page or `MAX_PAGES`. */
const pagesFrom = async <V extends z.ZodType>(
    context: ReadContext,
    type: string,
    values: V,
    query: ListQuery,
    cursor: string | null,
    page: number,
): Promise<ReadonlyArray<ReadRecord<z.output<V>>>> => {
    const args: JsonObject = {
        type,
        limit: PAGE_SIZE,
        ...(query.where === undefined ? {} : { where: query.where }),
        ...(query.order === undefined ? {} : { order: query.order }),
        ...(cursor === null ? {} : { cursor }),
    }
    const listed = pageOf(context, values, valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, args)))
    if (listed.next === null || page + 1 >= MAX_PAGES) return listed.records
    return [...listed.records, ...(await pagesFrom(context, type, values, query, listed.next, page + 1))]
}

/** Every record of a type a filter and an order select, page after page (at most `MAX_PAGES` pages). */
export const listAll = <V extends z.ZodType>(
    context: ReadContext,
    type: string,
    values: V,
    query: ListQuery,
): Promise<ReadonlyArray<ReadRecord<z.output<V>>>> => pagesFrom(context, type, values, query, null, 0)

/** The one record of a settings type, or null before the first save. */
const firstOf = async <V extends z.ZodType>(context: ReadContext, type: string, values: V): Promise<z.output<V> | null> => {
    const answer = valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, { type, limit: 1 }))
    const [first] = pageOf(context, values, answer).records
    return first === undefined ? null : first.values
}

/** The rules of the workspace's booking calendar; the defaults before the first save. */
export const bookingRulesOf = async (context: ReadContext): Promise<BookingRules> =>
    (await firstOf(context, BOOKING_TYPES.settings, settingsValues)) ?? { ...BOOKING_RULE_DEFAULTS }

/** The time zone every booking node plans in: the platform's default, the shop's own calendar kept no zone of its own. */
export const timeZoneOf = (): string => DEFAULT_TIME_ZONE

/** One booking by id, or null when the workspace holds none of that id. */
export const bookingById = async (context: ReadContext, bookingId: string): Promise<ReadRecord<BookingValues> | null> => {
    const answer = await context.tools.call(TOOL.recordGet, { type: BOOKING_TYPES.booking, id: bookingId })
    if (!answer.ok && answer.refusal === "not_found") return null
    const parsed = z.object({ record: rawRecord }).safeParse(valueOrCannot(context, TOOL.recordGet, answer))
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${TOOL.recordGet} answered an unknown shape` })
    return recordOf(context, TOOL.recordGet, bookingValues, parsed.data.record)
}

/** A record as the record tools answer it, for the examples: the id, a version, fixed times and the values. */
export const recordAnswer = (recordId: string, values: JsonObject): JsonObject => ({
    id: recordId,
    version: "1",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    values,
})
