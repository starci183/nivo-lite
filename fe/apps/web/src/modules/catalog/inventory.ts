import type { ModuleDef } from "./catalog.types"

/** The inventory module. */
export const INVENTORY = {
    key: "inventory",
    order: 60,
    icon: "servers",
    glyph: "moduleInventory",
    mascot: "/images/promo/mascot-checklist.png",
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
