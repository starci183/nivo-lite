import type { ModuleServer, ModuleTemplate, ModuleTemplateTrigger } from "@nivo-lite/agent-sdk/module"
import { webrenewCopy, webrenewList, webrenewText } from "./copy"
import { WEBRENEW } from "./declaration"

/**
 * The clock of the renewal round: every day at 08:00 in the workspace's zone, weekends included (owner decision 7: on a weekend the agent
 * holds the sends by the support-hours truth and reports them as held), with no probe.
 */
export const RENEW_ROUND_TRIGGER: ModuleTemplateTrigger = { key: "renew-round", preset: "daily_at", atTime: "08:00" }

/** One gate of the setup, in both languages. */
const gate = (
    key: string,
    label: "gates.rules.label" | "gates.prices.label" | "gates.crm.label",
    hint: "gates.rules.hint" | "gates.prices.hint" | "gates.crm.hint",
): ModuleTemplate["gates"][number] => ({
    key,
    label_vi: webrenewCopy(label, "vi"),
    label_en: webrenewCopy(label, "en"),
    hint_vi: webrenewCopy(hint, "vi"),
    hint_en: webrenewCopy(hint, "en"),
})

/** The catalogue template of the Renewal module: its copy, its agent, its setup gates and its clock. */
export const WEBRENEW_TEMPLATE: ModuleTemplate = {
    key: WEBRENEW,
    order: 210,
    name: webrenewText("name"),
    shortName: webrenewText("shortName"),
    description: webrenewText("description"),
    points: webrenewList(["points.0", "points.1", "points.2"]),
    purpose:
        "Reminds customers to renew before their services end, takes the answer, quotes so the customer pays first, and renews at the provider once the payment is recorded; its customer messages and the renewal run by themselves.",
    icon: "calendar",
    glyph: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4",
    mascot: "/images/promo/mascot-checklist.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBRENEW,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: ["openapi"] },
    connectionProviders: ["openapi", "zalo_oa", "smtp"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: webrenewText("agent.label"),
        handle: WEBRENEW,
        summary: webrenewText("agent.summary"),
        capabilities: webrenewList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: webrenewText("agent.role"),
        instructions: webrenewText("agent.instructions"),
    },
    gates: [
        gate("renewal_rules", "gates.rules.label", "gates.rules.hint"),
        gate("price_list", "gates.prices.label", "gates.prices.hint"),
        gate("crm", "gates.crm.label", "gates.crm.hint"),
    ],
    triggers: [RENEW_ROUND_TRIGGER],
}

/** The server half of the Renewal module, as the catalogue, the install door and the seed read it. */
export const WEBRENEW_SERVER: ModuleServer = { key: WEBRENEW, template: WEBRENEW_TEMPLATE }
