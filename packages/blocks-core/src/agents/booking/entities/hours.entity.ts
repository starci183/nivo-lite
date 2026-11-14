import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"

import { MAX_ENTRIES, MAX_ID } from "../../../shared/bounds"

/** The scope of the hours of the whole business: the date exceptions (closed days, other hours) every resource follows. */
export const BUSINESS_HOURS_SCOPE = "business"

/** A clock time, `HH:MM`. */
const clock = z.string().max(5).regex(/^([01]\d|2[0-3]):[0-5]\d$/u)

/** One weekly opening window. */
export type CalendarWindow = {
    /** The ISO weekday, 1 is Monday and 7 is Sunday. */
    readonly weekday: number
    /** The opening time, `HH:MM`. */
    readonly start: string
    /** The closing time, `HH:MM`. */
    readonly end: string
}

/** One date exception: closed, or open at other hours. */
export type CalendarException = {
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** Whether the date is closed. */
    readonly closed: boolean
    /** The opening time of an open exception, `HH:MM`, or null. */
    readonly start: string | null
    /** The closing time of an open exception, `HH:MM`, or null. */
    readonly end: string | null
}

/** The calendar a record keeps: the weekly windows and the date exceptions, folded in one value. */
export type BookingCalendar = {
    /** The weekly opening windows: the ISO weekday (1 is Monday), and the opening and closing times, `HH:MM`. */
    readonly weekly: ReadonlyArray<CalendarWindow>
    /** The date exceptions: a closed date, or other opening hours that date. */
    readonly exceptions: ReadonlyArray<CalendarException>
}

/** The shape of the calendar value. */
export const bookingCalendarShape: ZodType<BookingCalendar> = z.object({
    weekly: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: clock, end: clock })).max(MAX_ENTRIES),
    exceptions: z
        .array(
            z.object({
                date: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/u),
                closed: z.boolean(),
                start: clock.nullable(),
                end: clock.nullable(),
            }),
        )
        .max(MAX_ENTRIES),
})

type HoursFields = {
    readonly scope: FieldDef<"text", false>
    readonly resourceId: FieldDef<"uuid", true>
    readonly calendar: FieldDef<"jsonb", false> & { readonly shape: ZodType<BookingCalendar> }
}

const hoursFields: HoursFields = {
    scope: field.text({ maxLength: MAX_ID }),
    resourceId: field.uuid({ nullable: true }),
    calendar: field.jsonb({ shape: bookingCalendarShape }),
}

/**
 * The opening hours of one resource (its weekly windows and its own date exceptions), or of the whole business (`scope` `business`, no
 * resource: the date exceptions every resource follows). One record per scope; the scope of a resource is its id. Graph node kind
 * `booking-hours`.
 */
export const bookingHoursEntity: EntityDefinition<HoursFields> = defineEntity({
    name: "blocks-core.booking.hours",
    dataKind: "booking-hours",
    fields: hoursFields,
    indexes: [{ name: "scope", on: ["scope", "id"] }],
    constraints: [{ kind: "unique", name: "scope_key", on: ["scope"], refusal: "hours-exist" }],
})
