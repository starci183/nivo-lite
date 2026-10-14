import type { ModuleDef } from "./catalog.types"

/** The sales module. */
export const SALES = {
    key: "sales",
    order: 20,
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
    gates: [
        {
            key: "offer_pricing",
        },
        {
            key: "qualification",
        },
        {
            key: "followup_cadence",
        },
        {
            key: "approval_thresholds",
        },
        {
            key: "handoff_accounting",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "classify_lead",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: ["send_follow_up"],
        },
        {
            action: "send_follow_up",
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "send_quote",
            mode: "ask",
            limitVnd: null,
            requiredFields: ["amount_vnd"],
            amountLimit: true,
            maxMode: null,
            next: [],
        },
        {
            action: "confirm_order",
            mode: "auto",
            limitVnd: 20000000,
            requiredFields: ["customer", "items", "amount_vnd"],
            amountLimit: true,
            maxMode: null,
            next: ["issue_invoice"],
        },
        {
            action: "send_care",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
    ],
    accepts: [
        {
            command: "classify_lead",
            action: "classify_lead",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "send_follow_up",
            action: "send_follow_up",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "send_quote",
            action: "send_quote",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "confirm_order",
            action: "confirm_order",
            subjectType: "order",
            requiredFields: ["subject_id"],
        },
        {
            command: "send_care",
            action: "send_care",
            subjectType: "invoice",
            requiredFields: ["subject_id", "lead_id"],
        },
    ],
} satisfies ModuleDef
