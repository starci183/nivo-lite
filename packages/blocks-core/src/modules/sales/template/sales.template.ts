import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { ACCOUNTING_COPY as ledgerCopy } from "../ledger/template/copy"
import { loyaltyCopy } from "../loyalty/template/copy"
import { SALES_COPY as copy } from "./copy"

/** The sales module: its copy, agent and setup gates. */
export const SALES_TEMPLATE: ModuleTemplate = {
    key: "sales",
    order: 20,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "cart",
    glyph: "M4 17l5-5 4 4 7-8M15 8h5v5",
    mascot: "/images/promo/mascot-point.png",
    category: "sales_customer",
    status: "stable",
    audience: "internal",
    includedWithWorkspace: true,
    available: false,
    knowledgeFolder: "sales",
    workbench: "sales",
    settingsExtras: null,
    requires: {
        capabilities: ["customer_messaging"],
        connections: [],
        roles: {
            requires: ["payment.credits.list"],
            uses: ["identity.find", "identity.upsert", "receivable.find", "receivable.recordPayment", "invoice.list"],
        },
    },
    connectionProviders: ["telegram", "zalo_oa", "meta", "sepay", "payos", "casso"],
    defaultOperatingMode: "assist",
    // One role, many agents (owner ruling 2026-11-09): each Sales agent has its own name, picture, handle and channels.
    multiInstance: true,
    agent: {
        label: copy.text("agent.label"),
        handle: "sales",
        summary: copy.text("agent.summary"),
        capabilities: copy.list(["agent.capabilities.0", "agent.capabilities.1", "agent.capabilities.2"]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: [
        {
            key: "offer_pricing",
            label_vi: copy.one("gates.offer_pricing.label", "vi"),
            label_en: copy.one("gates.offer_pricing.label", "en"),
            hint_vi: copy.one("gates.offer_pricing.hint", "vi"),
            hint_en: copy.one("gates.offer_pricing.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "product",
                    attributeLabel: copy.one("gates.offer_pricing.writes.0.attributeLabel", "vi"),
                    scope: "public",
                },
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.offer_pricing.writes.1.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "qualification",
            label_vi: copy.one("gates.qualification.label", "vi"),
            label_en: copy.one("gates.qualification.label", "en"),
            hint_vi: copy.one("gates.qualification.hint", "vi"),
            hint_en: copy.one("gates.qualification.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.qualification.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "followup_cadence",
            label_vi: copy.one("gates.followup_cadence.label", "vi"),
            label_en: copy.one("gates.followup_cadence.label", "en"),
            hint_vi: copy.one("gates.followup_cadence.hint", "vi"),
            hint_en: copy.one("gates.followup_cadence.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.followup_cadence.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "approval_thresholds",
            label_vi: copy.one("gates.approval_thresholds.label", "vi"),
            label_en: copy.one("gates.approval_thresholds.label", "en"),
            hint_vi: copy.one("gates.approval_thresholds.hint", "vi"),
            hint_en: copy.one("gates.approval_thresholds.hint", "en"),
        },
        {
            key: "handoff_accounting",
            label_vi: copy.one("gates.handoff_accounting.label", "vi"),
            label_en: copy.one("gates.handoff_accounting.label", "en"),
            hint_vi: copy.one("gates.handoff_accounting.hint", "vi"),
            hint_en: copy.one("gates.handoff_accounting.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: copy.one("gates.handoff_accounting.writes.0.attributeLabel", "vi"),
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
        },
        {
            key: "scope",
            label_vi: ledgerCopy.one("gates.scope.label", "vi"),
            label_en: ledgerCopy.one("gates.scope.label", "en"),
            hint_vi: ledgerCopy.one("gates.scope.hint", "vi"),
            hint_en: ledgerCopy.one("gates.scope.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: ledgerCopy.one("gates.scope.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "currency_tax",
            label_vi: ledgerCopy.one("gates.currency_tax.label", "vi"),
            label_en: ledgerCopy.one("gates.currency_tax.label", "en"),
            hint_vi: ledgerCopy.one("gates.currency_tax.hint", "vi"),
            hint_en: ledgerCopy.one("gates.currency_tax.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: ledgerCopy.one("gates.currency_tax.writes.0.attributeLabel", "vi"),
                    scope: "internal",
                },
            ],
        },
        {
            key: "source_evidence",
            label_vi: ledgerCopy.one("gates.source_evidence.label", "vi"),
            label_en: ledgerCopy.one("gates.source_evidence.label", "en"),
            hint_vi: ledgerCopy.one("gates.source_evidence.hint", "vi"),
            hint_en: ledgerCopy.one("gates.source_evidence.hint", "en"),
        },
        {
            key: "approval_policy",
            label_vi: ledgerCopy.one("gates.approval_policy.label", "vi"),
            label_en: ledgerCopy.one("gates.approval_policy.label", "en"),
            hint_vi: ledgerCopy.one("gates.approval_policy.hint", "vi"),
            hint_en: ledgerCopy.one("gates.approval_policy.hint", "en"),
        },
        {
            key: "evidence_requirements",
            label_vi: ledgerCopy.one("gates.evidence_requirements.label", "vi"),
            label_en: ledgerCopy.one("gates.evidence_requirements.label", "en"),
            hint_vi: ledgerCopy.one("gates.evidence_requirements.hint", "vi"),
            hint_en: ledgerCopy.one("gates.evidence_requirements.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: ledgerCopy.one("gates.evidence_requirements.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "prohibited_actions",
            label_vi: ledgerCopy.one("gates.prohibited_actions.label", "vi"),
            label_en: ledgerCopy.one("gates.prohibited_actions.label", "en"),
            hint_vi: ledgerCopy.one("gates.prohibited_actions.hint", "vi"),
            hint_en: ledgerCopy.one("gates.prohibited_actions.hint", "en"),
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: ledgerCopy.one("gates.prohibited_actions.writes.0.attributeLabel", "vi"),
                    scope: "restricted",
                },
            ],
        },
        {
            key: "earn_rules",
            label_vi: loyaltyCopy("gates.earn_rules.label", "vi"),
            label_en: loyaltyCopy("gates.earn_rules.label", "en"),
            hint_vi: loyaltyCopy("gates.earn_rules.hint", "vi"),
            hint_en: loyaltyCopy("gates.earn_rules.hint", "en"),
        },
        {
            key: "tiers",
            label_vi: loyaltyCopy("gates.tiers.label", "vi"),
            label_en: loyaltyCopy("gates.tiers.label", "en"),
            hint_vi: loyaltyCopy("gates.tiers.hint", "vi"),
            hint_en: loyaltyCopy("gates.tiers.hint", "en"),
        },
        {
            key: "rewards",
            label_vi: loyaltyCopy("gates.rewards.label", "vi"),
            label_en: loyaltyCopy("gates.rewards.label", "en"),
            hint_vi: loyaltyCopy("gates.rewards.hint", "vi"),
            hint_en: loyaltyCopy("gates.rewards.hint", "en"),
        },
        {
            key: "limits",
            label_vi: loyaltyCopy("gates.limits.label", "vi"),
            label_en: loyaltyCopy("gates.limits.label", "en"),
            hint_vi: loyaltyCopy("gates.limits.hint", "vi"),
            hint_en: loyaltyCopy("gates.limits.hint", "en"),
        },
        {
            key: "expiry",
            label_vi: loyaltyCopy("gates.expiry.label", "vi"),
            label_en: loyaltyCopy("gates.expiry.label", "en"),
            hint_vi: loyaltyCopy("gates.expiry.hint", "vi"),
            hint_en: loyaltyCopy("gates.expiry.hint", "en"),
        },
        {
            key: "birthday",
            label_vi: loyaltyCopy("gates.birthday.label", "vi"),
            label_en: loyaltyCopy("gates.birthday.label", "en"),
            hint_vi: loyaltyCopy("gates.birthday.hint", "vi"),
            hint_en: loyaltyCopy("gates.birthday.hint", "en"),
        },
        {
            key: "promo_rules",
            label_vi: loyaltyCopy("gates.promo_rules.label", "vi"),
            label_en: loyaltyCopy("gates.promo_rules.label", "en"),
            hint_vi: loyaltyCopy("gates.promo_rules.hint", "vi"),
            hint_en: loyaltyCopy("gates.promo_rules.hint", "en"),
        },
        {
            key: "prohibited",
            label_vi: loyaltyCopy("gates.prohibited.label", "vi"),
            label_en: loyaltyCopy("gates.prohibited.label", "en"),
            hint_vi: loyaltyCopy("gates.prohibited.hint", "vi"),
            hint_en: loyaltyCopy("gates.prohibited.hint", "en"),
        },
        {
            key: "loyalty_tone",
            label_vi: loyaltyCopy("gates.tone.label", "vi"),
            label_en: loyaltyCopy("gates.tone.label", "en"),
            hint_vi: loyaltyCopy("gates.tone.hint", "vi"),
            hint_en: loyaltyCopy("gates.tone.hint", "en"),
        },
    
    ],
}

/** The sales module as the catalogue lists it: its template, read by the host through the installation. */
export const SALES_SERVER: ModuleServer = { key: "sales", template: SALES_TEMPLATE }
