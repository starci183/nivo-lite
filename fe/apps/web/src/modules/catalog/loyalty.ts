import type { ModuleDef } from "./catalog.types"

type LoyaltyShape = {
    key: "loyalty"
    order: number
    icon: string
    glyph: "moduleLoyalty"
    mascot: string
    category: "sales_customer"
    status: "early"
    audience: "customer"
    includedWithWorkspace: false
    available: true
    knowledgeFolder: string
    workbench: string
    settingsExtras: null
    requires: {
        capabilities: string[]
        connections: never[]
    }
    connectionProviders: string[]
    defaultOperatingMode: "assist"
    multiInstance: false
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "award_points"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "redeem_reward"
              mode: "auto"
              limitVnd: number
              requiredFields: never[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "send_promo"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "adjust_points"
              mode: "ask"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: "ask"
              next: never[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "award_points"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "redeem_reward"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_promo"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "adjust_points"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The loyalty module. */
export const LOYALTY: LoyaltyShape = {
    key: "loyalty",
    order: 70,
    icon: "reward",
    glyph: "moduleLoyalty",
    mascot: "/images/agents/loyalty.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "loyalty",
    workbench: "loyalty",
    settingsExtras: null,
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
