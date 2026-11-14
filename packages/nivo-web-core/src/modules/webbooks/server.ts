import type { ModuleServer, ModuleTemplate, ModuleTemplateTrigger } from "@nivo-lite/agent-sdk/module"
import { webbooksCopy, webbooksList, webbooksText } from "./copy"
import { WEBBOOKS } from "./declaration"

/**
 * The one clock of the Accounting agent: the receivable round, 09:00 on weekdays, with no probe. One clock only: a schedule wake goes to
 * ONE workflow of an agent (`workflow-route.policy.ts` of the engine), so the other three graphs are woken by hand-offs.
 */
export const DEBT_ROUND_TRIGGER: ModuleTemplateTrigger = { key: "debt-round", preset: "weekdays_at", atTime: "09:00" }

/** The catalogue template of the Accounting module: its copy, its agent, its setup gates and its clock. */
export const WEBBOOKS_TEMPLATE: ModuleTemplate = {
    key: WEBBOOKS,
    order: 210,
    name: webbooksText("name"),
    shortName: webbooksText("shortName"),
    description: webbooksText("description"),
    points: webbooksList(["points.0", "points.1", "points.2"]),
    purpose:
        "Proves renewal money on the bank feed and records it in the CRM, issues the invoice after a renewal on the owner's yes (the only step that asks: a legal act), reminds receivables and checks supplier invoices.",
    icon: "receipt",
    glyph: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
    mascot: "/images/promo/mascot-checklist.png",
    category: "finance",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBBOOKS,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: [] },
    connectionProviders: ["sepay", "smtp", "openapi"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: webbooksText("agent.label"),
        handle: WEBBOOKS,
        summary: webbooksText("agent.summary"),
        capabilities: webbooksList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: webbooksText("agent.role"),
        instructions: webbooksText("agent.instructions"),
    },
    gates: [
        {
            key: "payment_terms",
            label_vi: webbooksCopy("gates.terms.label", "vi"),
            label_en: webbooksCopy("gates.terms.label", "en"),
            hint_vi: webbooksCopy("gates.terms.hint", "vi"),
            hint_en: webbooksCopy("gates.terms.hint", "en"),
        },
        {
            key: "books_accounts",
            label_vi: webbooksCopy("gates.accounts.label", "vi"),
            label_en: webbooksCopy("gates.accounts.label", "en"),
            hint_vi: webbooksCopy("gates.accounts.hint", "vi"),
            hint_en: webbooksCopy("gates.accounts.hint", "en"),
        },
    ],
    triggers: [DEBT_ROUND_TRIGGER],
}

/** The server half of the Accounting module, as the catalogue, the install door and the seed read it. */
export const WEBBOOKS_SERVER: ModuleServer = { key: WEBBOOKS, template: WEBBOOKS_TEMPLATE }
