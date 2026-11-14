import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { HIRING_COPY as copy } from "./copy"

/** The hiring module: its copy, agent and setup gates. */
export const HIRING_TEMPLATE: ModuleTemplate = {
    key: "hiring",
    order: 100,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "jobs",
    glyph: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
    mascot: "/images/promo/mascot-point.png",
    category: "hr",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "hiring",
    workbench: "hiring",
    settingsExtras: null,
    requires: {
        capabilities: ["email"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: copy.text("agent.label"),
        handle: "hiring",
        summary: copy.text("agent.summary"),
        capabilities: copy.list(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "open_roles",
            label_vi: copy.one("gates.open_roles.label", "vi"),
            label_en: copy.one("gates.open_roles.label", "en"),
            hint_vi: copy.one("gates.open_roles.hint", "vi"),
            hint_en: copy.one("gates.open_roles.hint", "en"),
        },
        {
            key: "criteria",
            label_vi: copy.one("gates.criteria.label", "vi"),
            label_en: copy.one("gates.criteria.label", "en"),
            hint_vi: copy.one("gates.criteria.hint", "vi"),
            hint_en: copy.one("gates.criteria.hint", "en"),
        },
        {
            key: "interview_process",
            label_vi: copy.one("gates.interview_process.label", "vi"),
            label_en: copy.one("gates.interview_process.label", "en"),
            hint_vi: copy.one("gates.interview_process.hint", "vi"),
            hint_en: copy.one("gates.interview_process.hint", "en"),
        },
        {
            key: "offer_rules",
            label_vi: copy.one("gates.offer_rules.label", "vi"),
            label_en: copy.one("gates.offer_rules.label", "en"),
            hint_vi: copy.one("gates.offer_rules.hint", "vi"),
            hint_en: copy.one("gates.offer_rules.hint", "en"),
        },
        {
            key: "fairness",
            label_vi: copy.one("gates.fairness.label", "vi"),
            label_en: copy.one("gates.fairness.label", "en"),
            hint_vi: copy.one("gates.fairness.hint", "vi"),
            hint_en: copy.one("gates.fairness.hint", "en"),
        },
        {
            key: "privacy",
            label_vi: copy.one("gates.privacy.label", "vi"),
            label_en: copy.one("gates.privacy.label", "en"),
            hint_vi: copy.one("gates.privacy.hint", "vi"),
            hint_en: copy.one("gates.privacy.hint", "en"),
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

/** The hiring module as the catalogue lists it: its template, read by the host through the installation. */
export const HIRING_SERVER: ModuleServer = { key: "hiring", template: HIRING_TEMPLATE }
