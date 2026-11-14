import type { ModuleServer, ModuleTemplate, ModuleTemplateTrigger } from "@nivo-lite/agent-sdk/module"
import { websalesCopy, websalesList, websalesText } from "./copy"
import { WEBSALES } from "./declaration"

/** The clock of the follow-up round: working days at 08:30 in the workspace's zone (AGENTS-GRAPHS §9.6), with no probe. */
export const SALES_ROUND_TRIGGER: ModuleTemplateTrigger = { key: "sales-round", preset: "weekdays_at", atTime: "08:30" }

/** One gate of the setup, in both languages. */
const gate = (
    key: string,
    label: "gates.policy.label" | "gates.prices.label" | "gates.accounts.label",
    hint: "gates.policy.hint" | "gates.prices.hint" | "gates.accounts.hint",
): ModuleTemplate["gates"][number] => ({
    key,
    label_vi: websalesCopy(label, "vi"),
    label_en: websalesCopy(label, "en"),
    hint_vi: websalesCopy(hint, "vi"),
    hint_en: websalesCopy(hint, "en"),
})

/** The catalogue template of the Sales module: its copy, its agent, its setup gates and its clock. */
export const WEBSALES_TEMPLATE: ModuleTemplate = {
    key: WEBSALES,
    order: 215,
    name: websalesText("name"),
    shortName: websalesText("shortName"),
    description: websalesText("description"),
    points: websalesList(["points.0", "points.1", "points.2"]),
    purpose:
        "Takes a new customer's enquiry, asks the need, quotes from the CRM's price list and follows up unanswered quotes; a person of the team starts the close, and its customer messages, new customer and purchase record run by themselves.",
    icon: "calendar",
    glyph: "M4 5h2l2 10h9l2-7H7M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01",
    mascot: "/images/promo/mascot-checklist.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBSALES,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: ["openapi"] },
    connectionProviders: ["zalo_oa", "smtp", "openapi"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: websalesText("agent.label"),
        handle: WEBSALES,
        summary: websalesText("agent.summary"),
        capabilities: websalesList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: websalesText("agent.role"),
        instructions: websalesText("agent.instructions"),
    },
    gates: [
        gate("sales_policy", "gates.policy.label", "gates.policy.hint"),
        gate("price_sheet", "gates.prices.label", "gates.prices.hint"),
        gate("accounts", "gates.accounts.label", "gates.accounts.hint"),
    ],
    triggers: [SALES_ROUND_TRIGGER],
}

/** The server half of the Sales module, as the catalogue, the install door and the seed read it. */
export const WEBSALES_SERVER: ModuleServer = { key: WEBSALES, template: WEBSALES_TEMPLATE }
