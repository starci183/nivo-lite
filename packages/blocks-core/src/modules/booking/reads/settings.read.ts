import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { BOOKING_SETTINGS_KEY } from "../../../entities/booking/settings.entity"
import { BOOKING_RULE_DEFAULTS } from "../../../rules/booking/booking"
import { BOOKING_VIEW } from "../constants"
import { SETTINGS } from "../ports"

/** The calendar rules as the settings form shows them. */
export type BookingSettingsView = {
    /** The step between start times, in minutes. */
    readonly slotStepMin: number
    /** How soon a customer may book, in minutes from now. */
    readonly minLeadMin: number
    /** How far ahead a customer may book, in days. */
    readonly maxAdvanceDays: number
    /** How many hours before the start the reminder goes out. */
    readonly remindHoursBefore: number
}

const FIELDS: ReadonlyArray<keyof BookingSettingsView> = ["slotStepMin", "minLeadMin", "maxAdvanceDays", "remindHoursBefore"]

const stored = z.object({
    slotStepMin: z.number(),
    minLeadMin: z.number(),
    maxAdvanceDays: z.number(),
    remindHoursBefore: z.number(),
})

/** `blocks-core.booking.api.settings.get`: the rules of the calendar the workspace saved; the defaults before the first save. */
export const SETTINGS_READ: ReadDefinition = defineRead({
    id: "blocks-core.booking.api.settings.get",
    dataKind: "booking-settings",
    shape: "record",
    fields: FIELDS,
    paths: {},
    variables: z.object({}),
    permission: BOOKING_VIEW,
    ports: { settings: SETTINGS },
    run: async ({ settings }): Promise<BookingSettingsView> => {
        const page = await settings.list({
            select: [...FIELDS],
            where: q.eq("key", BOOKING_SETTINGS_KEY),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        const parsed = stored.safeParse(page.rows[0]?.row.data)
        return parsed.success ? parsed.data : { ...BOOKING_RULE_DEFAULTS }
    },
})
