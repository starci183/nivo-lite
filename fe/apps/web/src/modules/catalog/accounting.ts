import type { ModuleDef } from "./catalog.types"

/** The accounting module. */
export const ACCOUNTING = {
    key: "accounting",
    order: 30,
    name: {
        vi: "K\u1ebf to\u00e1n",
        en: "Accounting",
    },
    shortName: {
        vi: "K\u1ebf to\u00e1n AI",
        en: "Accounting AI",
    },
    description: {
        vi: "Bi\u1ebfn deal \u0111\u00e3 ch\u1ed1t th\u00e0nh b\u1ea3n nh\u00e1p h\u00f3a \u0111\u01a1n, \u0111\u1ed1i chi\u1ebfu thanh to\u00e1n v\u00e0 nh\u1eafc b\u1ea1n kho\u1ea3n kh\u00e1ch c\u00f2n n\u1ee3.",
        en: "Turns won deals into invoice drafts, matches payments and reminds you what customers owe.",
    },
    points: {
        vi: [
            "B\u1ea3n nh\u00e1p h\u00f3a \u0111\u01a1n theo ph\u1ea1m vi \u0111\u00e3 th\u1ed1ng nh\u1ea5t",
            "\u0110\u1ed1i chi\u1ebfu thanh to\u00e1n v\u00e0 nh\u1eafc n\u1ee3",
            "Nh\u1eadn deal \u0111\u00e3 ch\u1ed1t t\u1eeb B\u00e1n h\u00e0ng",
        ],
        en: ["Invoice drafts from agreed scope", "Payment matching and reminders", "Receives won deals from Sales"],
    },
    purpose:
        "an accounting assistant that drafts invoices from won deals, matches payments and reminds about receivables",
    icon: "wallet",
    glyph: "M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3",
    mascot: "/images/promo/mascot-checklist.png",
    category: "finance",
    status: "stable",
    audience: "internal",
    includedWithWorkspace: true,
    available: false,
    knowledgeFolder: "accounting",
    workbench: "accounting",
    settingsExtras: null,
    requires: {
        capabilities: [],
        connections: [],
    },
    connectionProviders: ["sepay", "payos", "casso"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        name: "Accounting Agent",
        handle: "accounting",
        summary: {
            vi: "Bi\u1ebfn deal \u0111\u00e3 ch\u1ed1t th\u00e0nh b\u1ea3n nh\u00e1p h\u00f3a \u0111\u01a1n v\u00e0 nh\u1eafc b\u1ea1n kho\u1ea3n kh\u00e1ch c\u00f2n n\u1ee3.",
            en: "Turns won deals into invoice drafts and reminds you what customers owe.",
        },
        capabilities: {
            vi: [
                "B\u1ea3n nh\u00e1p h\u00f3a \u0111\u01a1n theo ph\u1ea1m vi \u0111\u00e3 th\u1ed1ng nh\u1ea5t",
                "Nh\u1eafc thanh to\u00e1n",
                "Nh\u1eadn deal \u0111\u00e3 ch\u1ed1t t\u1eeb Sales",
            ],
            en: ["Invoice drafts from the agreed scope", "Payment reminders", "Receives won deals from Sales"],
        },
        role: {
            vi: "H\u00f3a \u0111\u01a1n v\u00e0 c\u00f4ng n\u1ee3",
            en: "Invoices & receivables",
        },
        instructions: {
            vi: "",
            en: "",
        },
    },
    gates: [
        {
            key: "scope",
            label_vi: "Ph\u1ea1m vi c\u00f4ng vi\u1ec7c",
            label_en: "Scope",
            hint_vi:
                "K\u1ebf to\u00e1n AI l\u00e0m nh\u1eefng vi\u1ec7c g\u00ec: h\u00f3a \u0111\u01a1n, \u0111\u1ed1i so\u00e1t, nh\u1eafc n\u1ee3...",
            hint_en: "What the accounting agent covers: invoices, reconciliation, reminders...",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Ph\u1ea1m vi k\u1ebf to\u00e1n AI",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "currency_tax",
            label_vi: "Ti\u1ec1n t\u1ec7 v\u00e0 thu\u1ebf",
            label_en: "Currency and tax",
            hint_vi: "\u0110\u01a1n v\u1ecb ti\u1ec1n, thu\u1ebf GTGT, quy t\u1eafc l\u00e0m tr\u00f2n.",
            hint_en: "Currency, VAT rate, rounding rules.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Thu\u1ebf VAT v\u00e0 l\u00e0m tr\u00f2n",
                    scope: "internal",
                },
            ],
        },
        {
            key: "source_evidence",
            label_vi: "Ngu\u1ed3n ch\u1ee9ng t\u1eeb",
            label_en: "Source evidence",
            hint_vi:
                "S\u1ed1 li\u1ec7u l\u1ea5y t\u1eeb \u0111\u00e2u: \u0111\u01a1n h\u00e0ng, sao k\u00ea ng\u00e2n h\u00e0ng, file...",
            hint_en: "Where figures come from: orders, bank statements, files...",
        },
        {
            key: "approval_policy",
            label_vi: "Ch\u00ednh s\u00e1ch duy\u1ec7t v\u00e0 ng\u01b0\u1ee1ng",
            label_en: "Approval policy and thresholds",
            hint_vi: "S\u1ed1 ti\u1ec1n n\u00e0o AI t\u1ef1 l\u00e0m, s\u1ed1 n\u00e0o c\u1ea7n b\u1ea1n duy\u1ec7t.",
            hint_en: "Amounts the AI handles alone and amounts you approve.",
            writes: [
                {
                    kind: "rule",
                    action: "issue_invoice",
                    field: "limit_vnd",
                },
                {
                    kind: "rule",
                    action: "reconcile_payment",
                    field: "limit_vnd",
                },
            ],
        },
        {
            key: "evidence_requirements",
            label_vi: "Y\u00eau c\u1ea7u ch\u1ee9ng t\u1eeb",
            label_en: "Evidence requirements",
            hint_vi:
                "C\u1ea7n nh\u1eefng ch\u1ee9ng t\u1eeb n\u00e0o tr\u01b0\u1edbc khi xu\u1ea5t h\u00f3a \u0111\u01a1n ho\u1eb7c ghi nh\u1eadn thanh to\u00e1n.",
            hint_en: "Documents required before invoicing or recording a payment.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Ch\u1ee9ng t\u1eeb b\u1eaft bu\u1ed9c",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "prohibited_actions",
            label_vi: "Vi\u1ec7c kh\u00f4ng \u0111\u01b0\u1ee3c l\u00e0m",
            label_en: "Prohibited actions",
            hint_vi:
                "Nh\u1eefng thao t\u00e1c tuy\u1ec7t \u0111\u1ed1i kh\u00f4ng t\u1ef1 l\u00e0m (ho\u00e0n ti\u1ec1n, h\u1ee7y h\u00f3a \u0111\u01a1n...).",
            hint_en: "Actions it must never take alone (refunds, voiding invoices...).",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Vi\u1ec7c k\u1ebf to\u00e1n AI kh\u00f4ng \u0111\u01b0\u1ee3c t\u1ef1 l\u00e0m",
                    scope: "restricted",
                },
                {
                    kind: "rule",
                    action: "send_email",
                    field: "mode",
                },
            ],
        },
    ],
    authorityActions: [
        {
            action: "issue_invoice",
            label: {
                vi: "Xu\u1ea5t h\u00f3a \u0111\u01a1n",
                en: "Issue invoice",
            },
            mode: "auto",
            limitVnd: 20000000,
            requiredFields: ["customer", "amount_vnd"],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "reconcile_payment",
            label: {
                vi: "\u0110\u1ed1i so\u00e1t thanh to\u00e1n",
                en: "Reconcile payment",
            },
            mode: "auto",
            limitVnd: 50000000,
            requiredFields: ["amount_vnd"],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: ["send_care"],
        },
        {
            action: "send_email",
            label: {
                vi: "G\u1eedi email cho kh\u00e1ch",
                en: "Send email to a customer",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
    ],
    accepts: [
        {
            command: "issue_invoice",
            action: "issue_invoice",
            subjectType: "order",
            requiredFields: ["subject_id"],
            description: {
                vi: "xu\u1ea5t phi\u1ebfu thu",
                en: "issue the invoice",
            },
        },
        {
            command: "reconcile_payment",
            action: "reconcile_payment",
            subjectType: "invoice",
            requiredFields: ["subject_id"],
            description: {
                vi: "\u0111\u1ed1i so\u00e1t kho\u1ea3n thanh to\u00e1n",
                en: "reconcile the payment",
            },
        },
        {
            command: "send_email",
            action: "send_email",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "g\u1eedi email cho kh\u00e1ch",
                en: "email the customer",
            },
        },
    ],
} satisfies ModuleDef
