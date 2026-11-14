import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { webdocsCopy, webdocsList, webdocsText } from "./copy"
import { WEBDOCS } from "./declaration"

/** A gate of the catalogue template, worded from the module's copy in both languages. */
const gateOf = (key: string, copy: "documents" | "crm"): ModuleTemplate["gates"][number] => ({
    key,
    label_vi: webdocsCopy(`gates.${copy}.label`, "vi"),
    label_en: webdocsCopy(`gates.${copy}.label`, "en"),
    hint_vi: webdocsCopy(`gates.${copy}.hint`, "vi"),
    hint_en: webdocsCopy(`gates.${copy}.hint`, "en"),
})

/**
 * The catalogue template of the Paperwork module: its copy, its agent, its setup gates and its one action. It is the beta agent of the
 * plugin, marked the way the catalogue marks one: `status: "early"` (early access; the web shows its early badge). No clock: it works
 * only when a person asks.
 */
export const WEBDOCS_TEMPLATE: ModuleTemplate = {
    key: WEBDOCS,
    order: 240,
    name: webdocsText("name"),
    shortName: webdocsText("shortName"),
    description: webdocsText("description"),
    points: webdocsList(["points.0", "points.1", "points.2"]),
    purpose: "Drafts paperwork from the company's documents and the CRM's customer records when a person of the team asks; files and signs nothing.",
    icon: "file",
    glyph: "M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4",
    mascot: "/images/promo/mascot-checklist.png",
    category: "operations",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBDOCS,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: ["openapi"] },
    connectionProviders: ["openapi"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: webdocsText("agent.label"),
        handle: WEBDOCS,
        summary: webdocsText("agent.summary"),
        capabilities: webdocsList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: webdocsText("agent.role"),
        instructions: webdocsText("agent.instructions"),
    },
    gates: [gateOf("documents", "documents"), gateOf("crm", "crm")],
}

/** The server half of the Paperwork module, as the catalogue, the install door and the seed read it. */
export const WEBDOCS_SERVER: ModuleServer = { key: WEBDOCS, template: WEBDOCS_TEMPLATE }
