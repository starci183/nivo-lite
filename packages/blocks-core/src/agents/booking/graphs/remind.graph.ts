import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { type TemplateCatalogue, type TemplateGraph, defineTemplateGraph, node, outcome, ref, trigger } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { bilingualOf } from "../../../shared/messages/catalog"
import { bookingRemindNode } from "../nodes/remind.node"

/** The key of the reminder workflow inside the Booking agent. */
export const REMIND_GRAPH_KEY = "booking.remind"

/** What the template catalogue shows of `booking.remind`. */
const CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("graphBookingRemindName"),
    summary: bilingualOf("graphBookingRemindSummary"),
    version: 3,
    publishedAt: "2026-11-14T03:00:00.000Z",
    notes: {
        vi: "Đọc sự kiện theo một đường chung: route, liên hệ, tài khoản và dữ liệu của sự kiện (trigger.data)",
        en: "Reads its event on the one pipeline: the route, the contact, the account and the event's data (trigger.data)",
    },
    // Seeded ACTIVE: a seed or re-seed adds it to the agent active, so its clock reaches it.
    seedActive: true,
}

/**
 * `booking.remind` (booking reminders), version 1: the hourly clock tick reminds every confirmed booking that starts within the workspace's
 * reminder window once (`remind`), then ends `reminded` with the counts. The clock's slot is bound in, so a late tick reminds by its own
 * hour; a person's "run now" supplies none and reminds by the run's instant.
 */
export const bookingRemindGraph: TemplateGraph = defineTemplateGraph({
    key: REMIND_GRAPH_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    // The clock's slot (epoch milliseconds, supplied by the clock tick); optional: a person's "run now" supplies none.
    input: z.object({ data: z.object({ slotMs: z.number().int().positive().nullable().optional() }).optional() }),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "hourly" } })],
    openTo: "agent",
    start: "remind",
    nodes: {
        remind: node(bookingRemindNode, { input: { slotMs: ref("trigger.data.slotMs") }, next: "reminded" }),
        reminded: outcome({
            name: "reminded",
            output: { reminded: ref("steps.remind.output.reminded"), refused: ref("steps.remind.output.refused") },
        }),
    },
})
