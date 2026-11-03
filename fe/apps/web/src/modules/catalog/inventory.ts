import type { ModuleDef } from "./catalog.types"

type InventoryShape = {
    key: "inventory"
    order: number
    icon: string
    glyph: "moduleInventory"
    mascot: string
    category: "operations"
    status: "early"
    audience: "internal"
    includedWithWorkspace: false
    available: true
    knowledgeFolder: string
    workbench: string
    settingsExtras: null
    requires: {
        capabilities: never[]
        connections: never[]
    }
    connectionProviders: never[]
    defaultOperatingMode: "assist"
    multiInstance: false
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "draft_purchase_order"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "send_purchase_order"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "adjust_stock"
              mode: "ask"
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
              action: "draft_purchase_order"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "send_purchase_order"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "adjust_stock"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The inventory module. */
export const INVENTORY: InventoryShape = {
    key: "inventory",
    order: 60,
    icon: "servers",
    glyph: "moduleInventory",
    mascot: "/images/agents/inventory.png",
    category: "operations",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "inventory",
    workbench: "inventory",
    settingsExtras: null,
    requires: {
        capabilities: [],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "items",
        },
        {
            key: "reorder_levels",
        },
        {
            key: "suppliers",
        },
        {
            key: "approval_thresholds",
        },
        {
            key: "stock_count",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "draft_purchase_order",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "send_purchase_order",
            mode: "ask",
            limitVnd: null,
            requiredFields: ["amount_vnd"],
            amountLimit: true,
            maxMode: null,
            next: [],
        },
        {
            action: "adjust_stock",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
    ],
    accepts: [
        {
            command: "draft_purchase_order",
            action: "draft_purchase_order",
            subjectType: "purchase_order",
            requiredFields: [],
        },
        {
            command: "send_purchase_order",
            action: "send_purchase_order",
            subjectType: "purchase_order",
            requiredFields: ["subject_id"],
        },
        {
            command: "adjust_stock",
            action: "adjust_stock",
            subjectType: "stock",
            requiredFields: ["subject_id"],
        },
    ],
} satisfies ModuleDef
