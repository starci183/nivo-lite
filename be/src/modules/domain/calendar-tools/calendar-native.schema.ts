import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { clockMinutesOf, knownZone } from "./calendar-slots.policy"

/**
 * The bounded arguments of the generic calendar tools. The provider documents few bounds (cited where they exist); a bound it does not
 * document is NIVO's own and says so. Moments are RFC 3339 with an offset (Google Calendar: "timeMin / timeMax ... must include a time zone
 * offset", https://developers.google.com/workspace/calendar/api/v3/reference/events/list), so no call depends on a hidden zone.
 */

/** NIVO's own bound of an id a provider answered (a calendar id is a mail address or an opaque id; no bound is documented). */
const ID_MAX = 1024

/** NIVO's own bounds (Calendar documents none for these text members). */
export const CALENDAR_SUMMARY_MAX = 1024
export const CALENDAR_DESCRIPTION_MAX = 8000
export const CALENDAR_LOCATION_MAX = 1024
export const CALENDAR_GUESTS_MAX = 100

/** NIVO's own bounds of a free-slot search: a window of at most 62 days, a slot from 5 minutes to a day, at most 200 slots. */
export const CALENDAR_WINDOW_MAX_DAYS = 62
export const CALENDAR_SLOT_MIN_MINUTES = 5
export const CALENDAR_SLOT_MAX_MINUTES = 1440
export const CALENDAR_SLOTS_MAX = 200
export const CALENDAR_SLOTS_DEFAULT = 50

/** The longest moment as text (RFC 3339 with a fraction and an offset is under 40), a guest address (RFC 5321: 320) and a clock (`HH:mm`). */
const MOMENT_MAX = 64
const GUEST_MAX = 320
const CLOCK_MAX = 5

const ZONE = z.string().min(1).max(64).refine(knownZone, { message: "unknown time zone" })
const MOMENT = z.iso.datetime({ offset: true }).max(MOMENT_MAX)
const calendarId = z
    .string()
    .trim()
    .min(1)
    .max(ID_MAX)
    .optional()
    .describe("The calendar; absent for the account's own (primary) calendar.")
const EVENT_REF = z.string().trim().min(1).max(ID_MAX)
const guests = z.array(z.email().max(GUEST_MAX)).max(CALENDAR_GUESTS_MAX)
const notify = z.boolean().optional().describe("Whether the guests are told; absent means no.")

export const CALENDAR_SLOT_FREE_LIST_SCHEMA: z.ZodType<{
    windowStart: string
    windowEnd: string
    durationMinutes: number
    calendarId?: string | undefined
    stepMinutes?: number | undefined
    timeZone?: string | undefined
    dailyHours?: { from: string; to: string } | undefined
    limit?: number | undefined
}> = z
    .object({
        calendarId,
        windowStart: MOMENT.describe("The start of the search window (RFC 3339 with an offset)."),
        windowEnd: MOMENT.describe(
            "The end of the search window (RFC 3339 with an offset), after the start, at most 62 days later.",
        ),
        durationMinutes: z
            .number()
            .int()
            .min(CALENDAR_SLOT_MIN_MINUTES)
            .max(CALENDAR_SLOT_MAX_MINUTES)
            .describe("The length of the slot wanted, in minutes."),
        stepMinutes: z
            .number()
            .int()
            .min(CALENDAR_SLOT_MIN_MINUTES)
            .max(CALENDAR_SLOT_MAX_MINUTES)
            .optional()
            .describe(
                "The distance between two slot starts inside one free stretch; absent means the slot length (no overlap).",
            ),
        timeZone: ZONE.describe(
            "The IANA zone the answer is told in and the daily hours are read in; absent means UTC.",
        ).optional(),
        dailyHours: z
            .object({
                from: z
                    .string()
                    .max(CLOCK_MAX)
                    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/u)
                    .describe("The day opens (HH:mm)."),
                to: z
                    .string()
                    .max(CLOCK_MAX)
                    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/u)
                    .describe("The day closes (HH:mm, or 24:00), after the opening."),
            })
            .strict()
            .optional()
            .describe("Only slots inside these local hours of each day; needs `timeZone`."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(CALENDAR_SLOTS_MAX)
            .optional()
            .describe("The most slots in the answer (default 50)."),
    })
    .strict()
    .refine((asked) => Date.parse(asked.windowEnd) > Date.parse(asked.windowStart), {
        message: "windowEnd must be after windowStart",
        path: ["windowEnd"],
    })
    .refine(
        (asked) => Date.parse(asked.windowEnd) - Date.parse(asked.windowStart) <= CALENDAR_WINDOW_MAX_DAYS * 86_400_000,
        {
            message: "the window is longer than 62 days",
            path: ["windowEnd"],
        },
    )
    .refine((asked) => asked.dailyHours === undefined || asked.timeZone !== undefined, {
        message: "dailyHours needs timeZone",
        path: ["timeZone"],
    })
    .refine(
        (asked) =>
            asked.dailyHours === undefined ||
            clockMinutesOf(asked.dailyHours.to) > clockMinutesOf(asked.dailyHours.from),
        {
            message: "dailyHours.to must be after dailyHours.from",
            path: ["dailyHours"],
        },
    )

export const CALENDAR_EVENT_CREATE_SCHEMA: z.ZodType<{
    summary: string
    start: string
    end: string
    calendarId?: string | undefined
    eventId?: string | undefined
    description?: string | undefined
    location?: string | undefined
    timeZone?: string | undefined
    guests?: Array<string> | undefined
    notifyGuests?: boolean | undefined
}> = z
    .object({
        calendarId,
        eventId: z
            .string()
            .max(ID_MAX)
            .regex(/^[a-v0-9]{5,1024}$/u)
            .optional()
            .describe(
                "Your own id for the event (lowercase a-v and 0-9, 5 to 1024 characters): a repeated call with the same id is refused as a duplicate, so it never makes two.",
            ),
        summary: z.string().trim().min(1).max(CALENDAR_SUMMARY_MAX).describe("The title."),
        description: z.string().max(CALENDAR_DESCRIPTION_MAX).optional().describe("The description."),
        location: z.string().max(CALENDAR_LOCATION_MAX).optional().describe("Where."),
        start: MOMENT.describe("When it starts (RFC 3339 with an offset)."),
        end: MOMENT.describe("When it ends (RFC 3339 with an offset), after the start."),
        timeZone: ZONE.describe(
            "The IANA zone the event is told in (for its own display); absent keeps the offsets.",
        ).optional(),
        guests: guests.optional().describe("The guests' mail addresses."),
        notifyGuests: notify,
    })
    .strict()
    .refine((asked) => Date.parse(asked.end) > Date.parse(asked.start), {
        message: "end must be after start",
        path: ["end"],
    })

export const CALENDAR_EVENT_UPDATE_SCHEMA: z.ZodType<{
    eventId: string
    calendarId?: string | undefined
    summary?: string | undefined
    description?: string | undefined
    location?: string | undefined
    start?: string | undefined
    end?: string | undefined
    timeZone?: string | undefined
    guests?: Array<string> | undefined
    notifyGuests?: boolean | undefined
}> = z
    .object({
        calendarId,
        eventId: EVENT_REF.describe("The event, as its create call answered it."),
        summary: z.string().trim().min(1).max(CALENDAR_SUMMARY_MAX).optional().describe("A new title."),
        description: z.string().max(CALENDAR_DESCRIPTION_MAX).optional().describe("A new description."),
        location: z.string().max(CALENDAR_LOCATION_MAX).optional().describe("A new place."),
        start: MOMENT.describe("A new start (RFC 3339 with an offset); give `end` with it.").optional(),
        end: MOMENT.describe("A new end (RFC 3339 with an offset); give `start` with it.").optional(),
        timeZone: ZONE.describe("The IANA zone of the new start and end.").optional(),
        guests: guests.optional().describe("The NEW whole guest list: it replaces the existing one."),
        notifyGuests: notify,
    })
    .strict()
    .refine((asked) => (asked.start === undefined) === (asked.end === undefined), {
        message: "start and end change together",
        path: ["end"],
    })
    .refine(
        (asked) =>
            asked.start === undefined || asked.end === undefined || Date.parse(asked.end) > Date.parse(asked.start),
        {
            message: "end must be after start",
            path: ["end"],
        },
    )
    .refine(
        (asked) =>
            asked.summary !== undefined ||
            asked.description !== undefined ||
            asked.location !== undefined ||
            asked.start !== undefined ||
            asked.guests !== undefined,
        { message: "nothing to change" },
    )

export const CALENDAR_EVENT_CANCEL_SCHEMA: z.ZodType<{
    eventId: string
    calendarId?: string | undefined
    notifyGuests?: boolean | undefined
}> = z
    .object({
        calendarId,
        eventId: EVENT_REF.describe("The event, as its create call answered it."),
        notifyGuests: notify,
    })
    .strict()

/** The schemas the manifest announces, generated from the validators. */
export const CALENDAR_SLOT_FREE_LIST_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CALENDAR_SLOT_FREE_LIST_SCHEMA, {
    io: "input",
    unrepresentable: "any",
})
export const CALENDAR_EVENT_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CALENDAR_EVENT_CREATE_SCHEMA, {
    io: "input",
    unrepresentable: "any",
})
export const CALENDAR_EVENT_UPDATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CALENDAR_EVENT_UPDATE_SCHEMA, {
    io: "input",
    unrepresentable: "any",
})
export const CALENDAR_EVENT_CANCEL_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CALENDAR_EVENT_CANCEL_SCHEMA, {
    io: "input",
})
