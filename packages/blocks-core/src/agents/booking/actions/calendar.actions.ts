import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { BUSINESS_HOURS_SCOPE, bookingCalendarShape } from "../entities/hours.entity"
import { BOOKING_SETTINGS_KEY } from "../entities/settings.entity"
import { BOOKING_MANAGE } from "../constants"
import { BOOKINGS, HOURS, SETTINGS } from "../ports"
import { refusedWith, writtenOf } from "./refusal"

/** The statuses a person moves a booking to from the workbench. */
const MOVES = ["confirmed", "cancelled", "done"] as const

/** The statuses a booking leaves no more: a person reopens nothing (a new booking is made instead). */
const CLOSED: ReadonlySet<string> = new Set(["cancelled", "done"])

/** `blocks-core.booking.booking-status-set`: confirms, cancels or closes as done the booking the id names; a cancelled or done booking stays as it is. */
export const SET_STATUS: ActionDefinition = defineAction({
    id: "blocks-core.booking.booking-status-set",
    permission: BOOKING_MANAGE,
    label: { key: "action_set_status" },
    input: z.object({ id: z.string().min(1).max(MAX_ID), status: z.enum(MOVES) }),
    ports: { bookings: BOOKINGS },
    transactional: true,
    run: async ({ bookings }, { id, status }) => {
        const found = await bookings.get(id)
        if (found === null) return refusedWith("record_missing")
        if (CLOSED.has(String(found.data["status"]))) return refusedWith("status_closed")
        return writtenOf(await bookings.update(id, found.version, { status }))
    },
    refreshes: ["blocks-core.booking.api.booking.list"],
    optimistic: false,
})

/** `blocks-core.booking.hours-save`: saves the weekly windows and date exceptions of one resource (by its id), or the exceptions of the whole business (no id). */
export const SAVE_HOURS: ActionDefinition = defineAction({
    id: "blocks-core.booking.hours-save",
    permission: BOOKING_MANAGE,
    label: { key: "action_save_hours" },
    input: z.object({ id: z.string().max(MAX_ID).optional(), calendar: bookingCalendarShape }),
    ports: { hours: HOURS },
    transactional: true,
    run: async ({ hours }, { id, calendar }) => {
        const resourceId = id === undefined || id === "" ? null : id
        return writtenOf(
            await hours.upsert("scope_key", {
                scope: resourceId ?? BUSINESS_HOURS_SCOPE,
                resourceId,
                calendar: { weekly: [...calendar.weekly], exceptions: [...calendar.exceptions] },
            }),
        )
    },
    refreshes: [],
    optimistic: false,
})

/** `blocks-core.booking.settings-save`: saves the rules of the calendar as the one `blocks-core.booking.settings` record of the workspace. */
export const SAVE_SETTINGS: ActionDefinition = defineAction({
    id: "blocks-core.booking.settings-save",
    permission: BOOKING_MANAGE,
    label: { key: "action_save_settings" },
    input: z.object({
        id: z.string().max(MAX_ID).optional(),
        slotStepMin: z.number().int().min(5).max(24 * 60),
        minLeadMin: z.number().int().min(0).max(60 * 24 * 30),
        maxAdvanceDays: z.number().int().min(1).max(365),
        remindHoursBefore: z.number().int().min(1).max(24 * 7),
    }),
    ports: { settings: SETTINGS },
    transactional: true,
    run: async ({ settings }, { slotStepMin, minLeadMin, maxAdvanceDays, remindHoursBefore }) =>
        writtenOf(
            await settings.upsert("booking_key", {
                key: BOOKING_SETTINGS_KEY,
                slotStepMin,
                minLeadMin,
                maxAdvanceDays,
                remindHoursBefore,
            }),
        ),
    refreshes: ["blocks-core.booking.api.settings.get"],
    optimistic: false,
})
