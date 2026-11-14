import type { ModuleServer, ModuleTemplate, ModuleTemplateTrigger } from "@nivo-lite/agent-sdk/module"
import { webmailCopy, webmailList, webmailText } from "./copy"
import { WEBMAIL } from "./declaration"

/** The clock the Mailbox agent reads its mail on: the shortest preset there is (every 15 minutes), with no probe. */
export const MAIL_ROUND_TRIGGER: ModuleTemplateTrigger = { key: "mail-round", preset: "every_15m" }

/** The catalogue template of the Mailbox module: its copy, its agent, its setup gates and its clock. */
export const WEBMAIL_TEMPLATE: ModuleTemplate = {
    key: WEBMAIL,
    order: 200,
    name: webmailText("name"),
    shortName: webmailText("shortName"),
    description: webmailText("description"),
    points: webmailList(["points.0", "points.1", "points.2"]),
    purpose: "Reads the new mail of the attached mailboxes and tells the team which mails need a person; never writes to a customer.",
    icon: "mail",
    glyph: "M3 6h18v12H3zM3 6l9 7 9-7",
    mascot: "/images/promo/mascot-checklist.png",
    category: "operations",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: WEBMAIL,
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: ["imap"] },
    connectionProviders: ["imap"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        label: webmailText("agent.label"),
        handle: WEBMAIL,
        summary: webmailText("agent.summary"),
        capabilities: webmailList(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2", "agent.capabilities.3"]),
        role: webmailText("agent.role"),
        instructions: webmailText("agent.instructions"),
    },
    gates: [
        {
            key: "mailboxes",
            label_vi: webmailCopy("gates.mailboxes.label", "vi"),
            label_en: webmailCopy("gates.mailboxes.label", "en"),
            hint_vi: webmailCopy("gates.mailboxes.hint", "vi"),
            hint_en: webmailCopy("gates.mailboxes.hint", "en"),
        },
        {
            key: "who_takes_mail",
            label_vi: webmailCopy("gates.who.label", "vi"),
            label_en: webmailCopy("gates.who.label", "en"),
            hint_vi: webmailCopy("gates.who.hint", "vi"),
            hint_en: webmailCopy("gates.who.hint", "en"),
        },
    ],
    triggers: [MAIL_ROUND_TRIGGER],
}

/** The server half of the Mailbox module, as the catalogue, the install door and the seed read it. */
export const WEBMAIL_SERVER: ModuleServer = { key: WEBMAIL, template: WEBMAIL_TEMPLATE }
