import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { CONTENT_COPY as copy } from "./copy"

/** The content module: its copy, agent and setup gates. */
export const CONTENT_TEMPLATE: ModuleTemplate = {
    key: "content",
    order: 90,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "blog",
    glyph: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    publishes: true,
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "content",
    workbench: "content",
    settingsExtras: null,
    requires: {
        capabilities: ["social_publish"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: copy.text("agent.label"),
        handle: "content",
        summary: copy.text("agent.summary"),
        capabilities: copy.list(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "channels",
            label_vi: copy.one("gates.channels.label", "vi"),
            label_en: copy.one("gates.channels.label", "en"),
            hint_vi: copy.one("gates.channels.hint", "vi"),
            hint_en: copy.one("gates.channels.hint", "en"),
        },
        {
            key: "audience",
            label_vi: copy.one("gates.audience.label", "vi"),
            label_en: copy.one("gates.audience.label", "en"),
            hint_vi: copy.one("gates.audience.hint", "vi"),
            hint_en: copy.one("gates.audience.hint", "en"),
        },
        {
            key: "pillars",
            label_vi: copy.one("gates.pillars.label", "vi"),
            label_en: copy.one("gates.pillars.label", "en"),
            hint_vi: copy.one("gates.pillars.hint", "vi"),
            hint_en: copy.one("gates.pillars.hint", "en"),
        },
        {
            key: "cadence",
            label_vi: copy.one("gates.cadence.label", "vi"),
            label_en: copy.one("gates.cadence.label", "en"),
            hint_vi: copy.one("gates.cadence.hint", "vi"),
            hint_en: copy.one("gates.cadence.hint", "en"),
        },
        {
            key: "claims_limits",
            label_vi: copy.one("gates.claims_limits.label", "vi"),
            label_en: copy.one("gates.claims_limits.label", "en"),
            hint_vi: copy.one("gates.claims_limits.hint", "vi"),
            hint_en: copy.one("gates.claims_limits.hint", "en"),
        },
        {
            key: "approval",
            label_vi: copy.one("gates.approval.label", "vi"),
            label_en: copy.one("gates.approval.label", "en"),
            hint_vi: copy.one("gates.approval.hint", "vi"),
            hint_en: copy.one("gates.approval.hint", "en"),
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

/** The content module as the catalogue lists it: its template, read by the host through the installation. */
export const CONTENT_SERVER: ModuleServer = { key: "content", template: CONTENT_TEMPLATE }
