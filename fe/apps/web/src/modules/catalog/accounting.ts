import type { ModuleDef } from "./catalog.types"

type AccountingShape = {
    key: "accounting"
    order: number
    icon: string
    glyph: "moduleAccounting"
    mascot: string
    category: "finance"
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
    multiInstance: false
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "issue_invoice"
              mode: "auto"
              limitVnd: number
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "reconcile_payment"
              mode: "auto"
              limitVnd: number
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: "send_care"[]
          }
        | {
              action: "send_email"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "issue_invoice"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "reconcile_payment"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_email"
              subjectType: string
              requiredFields: never[]
          }
    )[]
}

/** The accounting module. */
export const ACCOUNTING: AccountingShape = {
    key: "accounting",
    order: 30,
    icon: "wallet",
    glyph: "moduleAccounting",
    mascot: "/images/agents/accounting.png",
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
    gates: [
        {
            key: "scope",
        },
        {
            key: "currency_tax",
        },
        {
            key: "source_evidence",
        },
        {
            key: "approval_policy",
        },
        {
            key: "evidence_requirements",
        },
        {
            key: "prohibited_actions",
        },
    ],
    authorityActions: [
        {
            action: "issue_invoice",
            mode: "auto",
            limitVnd: 20000000,
            requiredFields: ["customer", "amount_vnd"],
            amountLimit: true,
            maxMode: null,
            next: [],
        },
        {
            action: "reconcile_payment",
            mode: "auto",
            limitVnd: 50000000,
            requiredFields: ["amount_vnd"],
            amountLimit: true,
            maxMode: null,
            next: ["send_care"],
        },
        {
            action: "send_email",
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
    ],
    accepts: [
        {
            command: "issue_invoice",
            action: "issue_invoice",
            subjectType: "order",
            requiredFields: ["subject_id"],
        },
        {
            command: "reconcile_payment",
            action: "reconcile_payment",
            subjectType: "invoice",
            requiredFields: ["subject_id"],
        },
        {
            command: "send_email",
            action: "send_email",
            subjectType: "inbound",
            requiredFields: [],
        },
    ],
} satisfies ModuleDef
