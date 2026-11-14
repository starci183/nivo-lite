import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { VIDEO_COPY as copy } from "./copy"

/** The video module: its copy, agent and setup gates. */
export const VIDEO_TEMPLATE: ModuleTemplate = {
    key: "video",
    order: 80,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "apps",
    glyph: "M4 6h12v12H4zM16 10l5-3v10l-5-3z",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    publishes: true,
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "video",
    workbench: "video",
    settingsExtras: null,
    requires: {
        capabilities: ["video_render"],
        connections: [],
    },
    connectionProviders: ["elevenlabs", "veo", "shotstack", "creatomate", "json2video"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: copy.text("agent.label"),
        handle: "video",
        summary: copy.text("agent.summary"),
        capabilities: copy.list(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "brand_assets",
            label_vi: copy.one("gates.brand_assets.label", "vi"),
            label_en: copy.one("gates.brand_assets.label", "en"),
            hint_vi: copy.one("gates.brand_assets.hint", "vi"),
            hint_en: copy.one("gates.brand_assets.hint", "en"),
        },
        {
            key: "video_goals",
            label_vi: copy.one("gates.video_goals.label", "vi"),
            label_en: copy.one("gates.video_goals.label", "en"),
            hint_vi: copy.one("gates.video_goals.hint", "vi"),
            hint_en: copy.one("gates.video_goals.hint", "en"),
        },
        {
            key: "formats",
            label_vi: copy.one("gates.formats.label", "vi"),
            label_en: copy.one("gates.formats.label", "en"),
            hint_vi: copy.one("gates.formats.hint", "vi"),
            hint_en: copy.one("gates.formats.hint", "en"),
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

/** The video module as the catalogue lists it: its template, read by the host through the installation. */
export const VIDEO_SERVER: ModuleServer = { key: "video", template: VIDEO_TEMPLATE }
