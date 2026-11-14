import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { webdeskCopy, webdeskList, webdeskText } from "./copy"
import { WEBDESK } from "./declaration"

/** The catalogue template of the Support module: its copy, its agent, its setup gates. No clock: it wakes on messages. */
export const WEBDESK_TEMPLATE: ModuleTemplate = {
    key: WEBDESK,
    order: 210,
    name: webdeskText("name"),
    shortName: webdeskText("shortName"),
    description: webdeskText("description"),
    points: webdeskList(["points.0", "points.1", "points.2"]),
    purpose:
        "The front door of the company's Zalo OA: understands a customer's message, opens a ticket for a fault, checks the system first, then proposes a fix to the team or a quote to the customer; never acts on a host or a site.",
    icon: "support",
    glyph: "M12 3a9 9 0 0 0-9 9v5h4v-6H5a7 7 0 0 1 14 0h-2v6h4v-5a9 9 0 0 0-9-9z",
    mascot: "/images/promo/mascot-checklist.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBDESK,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: ["customer_messaging"], connections: [] },
    connectionProviders: ["zalo_oa", "smtp", "openapi"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: webdeskText("agent.label"),
        handle: WEBDESK,
        summary: webdeskText("agent.summary"),
        capabilities: webdeskList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: webdeskText("agent.role"),
        instructions: webdeskText("agent.instructions"),
    },
    gates: [
        {
            key: "support_scope",
            label_vi: webdeskCopy("gates.article3.label", "vi"),
            label_en: webdeskCopy("gates.article3.label", "en"),
            hint_vi: webdeskCopy("gates.article3.hint", "vi"),
            hint_en: webdeskCopy("gates.article3.hint", "en"),
        },
        {
            key: "accounts",
            label_vi: webdeskCopy("gates.zalo.label", "vi"),
            label_en: webdeskCopy("gates.zalo.label", "en"),
            hint_vi: webdeskCopy("gates.zalo.hint", "vi"),
            hint_en: webdeskCopy("gates.zalo.hint", "en"),
        },
    ],
}

/** The server half of the Support module, as the catalogue, the install door and the seed read it. */
export const WEBDESK_SERVER: ModuleServer = { key: WEBDESK, template: WEBDESK_TEMPLATE }
