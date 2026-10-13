import type { ModuleDef } from "./catalog.types"

/** The sales module. */
export const SALES = {
    key: "sales",
    order: 20,
    name: {
        vi: "B\u00e1n h\u00e0ng",
        en: "Sales",
    },
    shortName: {
        vi: "Sales AI",
        en: "Sales AI",
    },
    description: {
        vi: "Theo d\u00f5i t\u1eebng kh\u00e1ch h\u00e0ng, \u0111\u1ec1 xu\u1ea5t b\u01b0\u1edbc ti\u1ebfp theo v\u00e0 so\u1ea1n tin nh\u1eafn \u0111\u1ec3 b\u1ea1n duy\u1ec7t.",
        en: "Follows up every lead, proposes the next step and drafts messages for your approval.",
    },
    points: {
        vi: [
            "Ph\u1ee5 tr\u00e1ch m\u1ecdi kh\u00e1ch h\u00e0ng m\u1edbi",
            "So\u1ea1n b\u1ea3n nh\u00e1p theo d\u00f5i \u0111\u1ec3 b\u1ea1n duy\u1ec7t",
            "Chuy\u1ec3n deal \u0111\u00e3 ch\u1ed1t cho K\u1ebf to\u00e1n",
        ],
        en: ["Owns each new lead", "Drafts follow-ups for approval", "Hands won deals to Accounting"],
    },
    purpose:
        "a sales assistant that follows up leads, proposes next steps and drafts messages for the owner to approve",
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
        capabilities: [],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        name: "Sales Agent",
        handle: "sales",
        summary: {
            vi: "Theo d\u00f5i t\u1eebng kh\u00e1ch h\u00e0ng, \u0111\u1ec1 xu\u1ea5t b\u01b0\u1edbc ti\u1ebfp theo v\u00e0 so\u1ea1n tin nh\u1eafn \u0111\u1ec3 b\u1ea1n duy\u1ec7t.",
            en: "Follows up every lead, proposes the next step and drafts messages for your approval.",
        },
        capabilities: {
            vi: [
                "Ph\u1ee5 tr\u00e1ch m\u1ecdi kh\u00e1ch h\u00e0ng m\u1edbi",
                "So\u1ea1n b\u1ea3n nh\u00e1p theo d\u00f5i \u0111\u1ec3 b\u1ea1n duy\u1ec7t",
                "Chuy\u1ec3n deal \u0111\u00e3 ch\u1ed1t cho Accounting",
            ],
            en: ["Owns each new lead", "Drafts follow-ups for approval", "Hands won deals to Accounting"],
        },
        role: {
            vi: "Theo d\u00f5i kh\u00e1ch h\u00e0ng v\u00e0 so\u1ea1n \u0111\u1ec1 xu\u1ea5t",
            en: "Lead follow-up & proposals",
        },
        instructions: {
            vi: "",
            en: "",
        },
    },
    gates: [
        {
            key: "offer_pricing",
            label_vi: "G\u00f3i b\u00e1n v\u00e0 quy t\u1eafc gi\u00e1",
            label_en: "Offer and pricing rules",
            hint_vi: "B\u1ea1n b\u00e1n g\u00ec, b\u1ea3ng gi\u00e1, m\u1ee9c gi\u1ea3m t\u1ed1i \u0111a.",
            hint_en: "What you sell, price list, maximum discount.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "product",
                    attributeLabel: "Gi\u00e1",
                    scope: "public",
                },
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "M\u1ee9c gi\u1ea3m gi\u00e1 t\u1ed1i \u0111a",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "qualification",
            label_vi: "Ti\u00eau ch\u00ed kh\u00e1ch ti\u1ec1m n\u0103ng",
            label_en: "Qualification criteria",
            hint_vi:
                "Kh\u00e1ch th\u1ebf n\u00e0o l\u00e0 \u0111\u00e1ng theo \u0111u\u1ed5i, th\u1ebf n\u00e0o th\u00ec b\u1ecf qua.",
            hint_en: "Which leads are worth pursuing and which to drop.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Ti\u00eau ch\u00ed kh\u00e1ch ti\u1ec1m n\u0103ng",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "followup_cadence",
            label_vi: "Nh\u1ecbp theo d\u00f5i",
            label_en: "Follow-up cadence",
            hint_vi: "Bao l\u00e2u theo d\u00f5i m\u1ed9t l\u1ea7n, t\u1ed1i \u0111a m\u1ea5y l\u1ea7n.",
            hint_en: "How often to follow up and how many times at most.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Nh\u1ecbp follow-up",
                    scope: "restricted",
                },
                {
                    kind: "rule",
                    action: "send_follow_up",
                    field: "mode",
                },
            ],
        },
        {
            key: "approval_thresholds",
            label_vi: "Ng\u01b0\u1ee1ng c\u1ea7n duy\u1ec7t",
            label_en: "Approval thresholds",
            hint_vi:
                "B\u00e1o gi\u00e1 ho\u1eb7c \u0111\u01a1n t\u1eeb bao nhi\u00eau ti\u1ec1n th\u00ec c\u1ea7n b\u1ea1n duy\u1ec7t.",
            hint_en: "Quote or order amounts above which you must approve.",
            writes: [
                {
                    kind: "rule",
                    action: "confirm_order",
                    field: "limit_vnd",
                },
                {
                    kind: "rule",
                    action: "send_quote",
                    field: "mode",
                },
            ],
        },
        {
            key: "handoff_accounting",
            label_vi: "Chuy\u1ec3n sang K\u1ebf to\u00e1n",
            label_en: "Handoff to accounting",
            hint_vi:
                "Khi n\u00e0o \u0111\u01a1n \u0111\u00e3 ch\u1ed1t v\u00e0 c\u1ea7n nh\u1eefng th\u00f4ng tin g\u00ec \u0111\u1ec3 xu\u1ea5t h\u00f3a \u0111\u01a1n.",
            hint_en: "When a deal counts as won and what accounting needs to invoice.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel:
                        "Khi n\u00e0o \u0111\u01a1n \u0111\u01b0\u1ee3c t\u00ednh l\u00e0 th\u00e0nh c\u00f4ng",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "tone",
            label_vi: "Gi\u1ecdng \u0111i\u1ec7u",
            label_en: "Tone",
            hint_vi: "C\u00e1ch x\u01b0ng h\u00f4 v\u00e0 phong c\u00e1ch khi nh\u1eafn kh\u00e1ch.",
            hint_en: "How it addresses customers and the style of its messages.",
        },
    ],
    authorityActions: [
        {
            action: "classify_lead",
            label: {
                vi: "Ph\u00e2n lo\u1ea1i",
                en: "Classify lead",
            },
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: ["send_follow_up"],
        },
        {
            action: "send_follow_up",
            label: {
                vi: "G\u1eedi theo d\u00f5i",
                en: "Send follow-up",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "send_quote",
            label: {
                vi: "G\u1eedi b\u00e1o gi\u00e1",
                en: "Send quote",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: ["amount_vnd"],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "confirm_order",
            label: {
                vi: "X\u00e1c nh\u1eadn \u0111\u01a1n h\u00e0ng",
                en: "Confirm order",
            },
            mode: "auto",
            limitVnd: 20000000,
            requiredFields: ["customer", "items", "amount_vnd"],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: ["issue_invoice"],
        },
        {
            action: "send_care",
            label: {
                vi: "G\u1eedi ch\u0103m s\u00f3c",
                en: "Send customer care",
            },
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
    ],
    accepts: [
        {
            command: "classify_lead",
            action: "classify_lead",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "ph\u00e2n lo\u1ea1i kh\u00e1ch",
                en: "classify the lead",
            },
        },
        {
            command: "send_follow_up",
            action: "send_follow_up",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "so\u1ea1n tin theo d\u00f5i",
                en: "follow up",
            },
        },
        {
            command: "send_quote",
            action: "send_quote",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "g\u1eedi b\u00e1o gi\u00e1",
                en: "send a quote",
            },
        },
        {
            command: "confirm_order",
            action: "confirm_order",
            subjectType: "order",
            requiredFields: ["subject_id"],
            description: {
                vi: "x\u00e1c nh\u1eadn \u0111\u01a1n h\u00e0ng",
                en: "confirm the order",
            },
        },
        {
            command: "send_care",
            action: "send_care",
            subjectType: "invoice",
            requiredFields: ["subject_id", "lead_id"],
            description: {
                vi: "g\u1eedi tin ch\u0103m s\u00f3c",
                en: "send the care message",
            },
        },
    ],
} satisfies ModuleDef
