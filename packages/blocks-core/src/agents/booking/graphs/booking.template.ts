import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { BOOKING_COPY as copy } from "./copy"

/** The booking module: its copy, agent and setup gates. */
export const BOOKING_TEMPLATE: ModuleTemplate = {
    key: "booking",
    order: 50,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "saved",
    glyph: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M9 14h2v2H9z",
    mascot: "/images/promo/mascot-point.png",
    category: "operations",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "booking",
    workbench: "booking",
    settingsExtras: null,
    requires: {
        capabilities: ["customer_chat", "calendar"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    agent: {
        label: copy.text("agent.label"),
        handle: "booking",
        summary: copy.text("agent.summary"),
        capabilities: copy.list(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "services",
            label_vi: copy.one("gates.services.label", "vi"),
            label_en: copy.one("gates.services.label", "en"),
            hint_vi: copy.one("gates.services.hint", "vi"),
            hint_en: copy.one("gates.services.hint", "en"),
        },
        {
            key: "capacity",
            label_vi: copy.one("gates.capacity.label", "vi"),
            label_en: copy.one("gates.capacity.label", "en"),
            hint_vi: copy.one("gates.capacity.hint", "vi"),
            hint_en: copy.one("gates.capacity.hint", "en"),
        },
        {
            key: "hours_buffer",
            label_vi: copy.one("gates.hours_buffer.label", "vi"),
            label_en: copy.one("gates.hours_buffer.label", "en"),
            hint_vi: copy.one("gates.hours_buffer.hint", "vi"),
            hint_en: copy.one("gates.hours_buffer.hint", "en"),
        },
        {
            key: "cancel_policy",
            label_vi: copy.one("gates.cancel_policy.label", "vi"),
            label_en: copy.one("gates.cancel_policy.label", "en"),
            hint_vi: copy.one("gates.cancel_policy.hint", "vi"),
            hint_en: copy.one("gates.cancel_policy.hint", "en"),
        },
        {
            key: "reminders",
            label_vi: copy.one("gates.reminders.label", "vi"),
            label_en: copy.one("gates.reminders.label", "en"),
            hint_vi: copy.one("gates.reminders.hint", "vi"),
            hint_en: copy.one("gates.reminders.hint", "en"),
        },
        {
            key: "handoff",
            label_vi: copy.one("gates.handoff.label", "vi"),
            label_en: copy.one("gates.handoff.label", "en"),
            hint_vi: copy.one("gates.handoff.hint", "vi"),
            hint_en: copy.one("gates.handoff.hint", "en"),
        },
        {
            key: "tone",
            label_vi: copy.one("gates.tone.label", "vi"),
            label_en: copy.one("gates.tone.label", "en"),
            hint_vi: copy.one("gates.tone.hint", "vi"),
            hint_en: copy.one("gates.tone.hint", "en"),
        },
    ],
}

/** The booking module as the catalogue lists it: its template, read by the host through the installation. */
export const BOOKING_SERVER: ModuleServer = { key: "booking", template: BOOKING_TEMPLATE }
