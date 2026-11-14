import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { CHATBOT_COPY as copy } from "./copy"

/** The chatbot module: its copy, agent and setup gates. */
export const CHATBOT_TEMPLATE: ModuleTemplate = {
    key: "chatbot",
    order: 10,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "support",
    glyph: "M4 5h16v10H9l-5 4z",
    mascot: "/images/promo/mascot-chat.png",
    category: "sales_customer",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "chatbot",
    workbench: "chatbot",
    settingsExtras: "chatbot_reply",
    requires: {
        capabilities: ["customer_chat"],
        connections: [],
        roles: { requires: [], uses: ["identity.find", "identity.upsert"] },
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    agent: {
        label: copy.text("agent.label"),
        handle: "chatbot",
        summary: copy.text("agent.summary"),
        capabilities: copy.list([
            "agent.capabilities.0",
            "agent.capabilities.1",
            "agent.capabilities.2",
            "agent.capabilities.3",
        ]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "identity",
            label_vi: copy.one("gates.identity.label", "vi"),
            label_en: copy.one("gates.identity.label", "en"),
            hint_vi: copy.one("gates.identity.hint", "vi"),
            hint_en: copy.one("gates.identity.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: copy.one("gates.identity.writes.0.attributeLabel", "vi"),
                    scope: "public",
                },
            ],
        },
        {
            key: "products",
            label_vi: copy.one("gates.products.label", "vi"),
            label_en: copy.one("gates.products.label", "en"),
            hint_vi: copy.one("gates.products.hint", "vi"),
            hint_en: copy.one("gates.products.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "product",
                    attributeLabel: copy.one("gates.products.writes.0.attributeLabel", "vi"),
                    scope: "public",
                },
            ],
        },
        {
            key: "support_scope",
            label_vi: copy.one("gates.support_scope.label", "vi"),
            label_en: copy.one("gates.support_scope.label", "en"),
            hint_vi: copy.one("gates.support_scope.hint", "vi"),
            hint_en: copy.one("gates.support_scope.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.support_scope.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "channels",
            label_vi: copy.one("gates.channels.label", "vi"),
            label_en: copy.one("gates.channels.label", "en"),
            hint_vi: copy.one("gates.channels.hint", "vi"),
            hint_en: copy.one("gates.channels.hint", "en"),
        },
        {
            key: "hours_sla",
            label_vi: copy.one("gates.hours_sla.label", "vi"),
            label_en: copy.one("gates.hours_sla.label", "en"),
            hint_vi: copy.one("gates.hours_sla.hint", "vi"),
            hint_en: copy.one("gates.hours_sla.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: copy.one("gates.hours_sla.writes.0.attributeLabel", "vi"),
                    scope: "public",
                },
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: copy.one("gates.hours_sla.writes.1.attributeLabel", "vi"),
                    scope: "internal",
                },
            ],
        },
        {
            key: "handoff",
            label_vi: copy.one("gates.handoff.label", "vi"),
            label_en: copy.one("gates.handoff.label", "en"),
            hint_vi: copy.one("gates.handoff.hint", "vi"),
            hint_en: copy.one("gates.handoff.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: copy.one("gates.handoff.writes.0.attributeLabel", "vi"),
                    scope: "internal",
                },
            ],
        },
        {
            key: "prohibited",
            label_vi: copy.one("gates.prohibited.label", "vi"),
            label_en: copy.one("gates.prohibited.label", "en"),
            hint_vi: copy.one("gates.prohibited.hint", "vi"),
            hint_en: copy.one("gates.prohibited.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.prohibited.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "tone",
            label_vi: copy.one("gates.tone.label", "vi"),
            label_en: copy.one("gates.tone.label", "en"),
            hint_vi: copy.one("gates.tone.hint", "vi"),
            hint_en: copy.one("gates.tone.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.tone.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
    ],
}

/** The chatbot module as the catalogue lists it: its template, read by the host through the installation. */
export const CHATBOT_SERVER: ModuleServer = { key: "chatbot", template: CHATBOT_TEMPLATE }
