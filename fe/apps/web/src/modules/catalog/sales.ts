import type { ModuleDef } from "./catalog.types"

type SalesShape = {
    key: "sales"
    order: number
    icon: string
    glyph: "moduleSales"
    mascot: string
    category: "sales_customer"
    status: "stable"
    audience: "internal"
    includedWithWorkspace: true
    available: false
    knowledgeFolder: string
    workbench: string
    settingsExtras: null
    requires: {
        capabilities: never[]
        connections: never[]
    }
    connectionProviders: string[]
    defaultOperatingMode: "assist"
    multiInstance: true
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "classify_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: "send_follow_up"[]
          }
        | {
              action: "send_follow_up"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "send_quote"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "confirm_order"
              mode: "auto"
              limitVnd: number
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: "issue_invoice"[]
          }
        | {
              action: "send_care"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "classify_lead"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_follow_up"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_quote"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "confirm_order"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_care"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The sales module. */
export const SALES: SalesShape = {
    key: "sales",
    order: 20,
    icon: "cart",
    glyph: "moduleSales",
    mascot: "/images/agents/sales.png",
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
    multiInstance: true,
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
