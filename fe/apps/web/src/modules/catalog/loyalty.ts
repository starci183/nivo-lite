import type { ModuleDef } from "./catalog.types"

/** The loyalty module. */
export const LOYALTY = {
    key: "loyalty",
    order: 70,
    icon: "reward",
    glyph: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    mascot: "/images/promo/mascot-offer.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "loyalty",
    workbench: "loyalty",
    settingsExtras: "loyalty_program",
    requires: {
        capabilities: ["customer_messaging"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "earn_rules",
        },
        {
            key: "tiers",
        },
        {
            key: "rewards",
        },
        {
            key: "limits",
        },
        {
            key: "expiry",
        },
        {
            key: "birthday",
        },
        {
            key: "promo_rules",
        },
        {
            key: "prohibited",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "award_points",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "redeem_reward",
            mode: "auto",
            limitVnd: 500000,
            requiredFields: [],
            amountLimit: true,
            maxMode: null,
            next: [],
        },
        {
            action: "send_promo",
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "adjust_points",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: "ask",
            next: [],
        },
    ],
    accepts: [
        {
            command: "award_points",
            action: "award_points",
            subjectType: "lead",
            requiredFields: [],
        },
        {
            command: "redeem_reward",
            action: "redeem_reward",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "send_promo",
            action: "send_promo",
            subjectType: "lead",
            requiredFields: [],
        },
        {
            command: "adjust_points",
            action: "adjust_points",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
    ],
} satisfies ModuleDef
