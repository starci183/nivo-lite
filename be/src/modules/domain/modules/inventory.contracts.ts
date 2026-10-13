import type { ModuleDefinition } from "./modules.contracts"

/** The inventory module: its copy, agent, setup gates, authority actions and accepted commands. */
export const INVENTORY_MODULE: ModuleDefinition = {
    key: "inventory",
    order: 60,
    name: {
        vi: "Kho & nh\u1eadp h\u00e0ng",
        en: "Stock and purchasing",
    },
    shortName: {
        vi: "Kho AI",
        en: "Stock AI",
    },
    description: {
        vi: "Theo d\u00f5i t\u1ed3n kho, b\u00e1o m\u00f3n s\u1eafp h\u1ebft v\u00e0 so\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng; g\u1eedi \u0111\u01a1n cho nh\u00e0 cung c\u1ea5p v\u00e0 ch\u1ec9nh s\u1ed1 t\u1ed3n \u0111\u1ec1u do b\u1ea1n duy\u1ec7t.",
        en: "Tracks stock, flags items running low and drafts purchase orders; sending an order or adjusting stock waits for your approval.",
    },
    points: {
        vi: [
            "B\u00e1o m\u00f3n s\u1eafp h\u1ebft theo m\u1ee9c t\u1ed3n t\u1ed1i thi\u1ec3u",
            "So\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng cho nh\u00e0 cung c\u1ea5p",
            "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi \u0111\u01a1n ho\u1eb7c ch\u1ec9nh s\u1ed1 t\u1ed3n",
        ],
        en: [
            "Flags items below the minimum level",
            "Drafts purchase orders for suppliers",
            "Asks you before sending an order or adjusting stock",
        ],
    },
    purpose:
        "a stock and purchasing assistant that tracks stock levels, flags items running low and drafts purchase orders for the owner to approve",
    icon: "servers",
    glyph: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
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
    agent: {
        name: "Inventory Agent",
        handle: "inventory",
        summary: {
            vi: "Theo d\u00f5i t\u1ed3n kho, b\u00e1o m\u00f3n s\u1eafp h\u1ebft v\u00e0 so\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng; g\u1eedi \u0111\u01a1n cho nh\u00e0 cung c\u1ea5p v\u00e0 ch\u1ec9nh s\u1ed1 t\u1ed3n \u0111\u1ec1u do b\u1ea1n duy\u1ec7t.",
            en: "Tracks stock, flags items running low and drafts purchase orders; sending an order or adjusting stock waits for your approval.",
        },
        capabilities: {
            vi: [
                "B\u00e1o m\u00f3n s\u1eafp h\u1ebft theo m\u1ee9c t\u1ed3n t\u1ed1i thi\u1ec3u",
                "So\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng cho nh\u00e0 cung c\u1ea5p",
                "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi \u0111\u01a1n ho\u1eb7c ch\u1ec9nh s\u1ed1 t\u1ed3n",
            ],
            en: [
                "Flags items below the minimum level",
                "Drafts purchase orders for suppliers",
                "Asks you before sending an order or adjusting stock",
            ],
        },
        role: {
            vi: "Theo d\u00f5i t\u1ed3n kho v\u00e0 so\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng",
            en: "Watches stock and drafts purchase orders",
        },
        instructions: {
            vi: "Theo d\u00f5i m\u1ee9c t\u1ed3n, b\u00e1o khi d\u01b0\u1edbi m\u1ee9c t\u1ed1i thi\u1ec3u v\u00e0 so\u1ea1n \u0111\u01a1n nh\u1eadp theo nh\u00e0 cung c\u1ea5p quen. Kh\u00f4ng g\u1eedi \u0111\u01a1n hay ch\u1ec9nh s\u1ed1 t\u1ed3n khi ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t.",
            en: "Watch stock levels, flag items below the minimum and draft orders for the usual supplier. Never send an order or adjust stock without approval.",
        },
    },
    gates: [
        {
            key: "items",
            label_vi: "Danh m\u1ee5c h\u00e0ng v\u00e0 \u0111\u01a1n v\u1ecb",
            label_en: "Items and units",
            hint_vi:
                "H\u00e0ng h\u00f3a, v\u1eadt t\u01b0 n\u00e0o c\u1ea7n theo d\u00f5i, \u0111\u01a1n v\u1ecb t\u00ednh, m\u00e3 ho\u1eb7c t\u00ean g\u1ecdi.",
            hint_en: "Which goods or supplies to track, their units and names.",
        },
        {
            key: "reorder_levels",
            label_vi: "M\u1ee9c t\u1ed3n t\u1ed1i thi\u1ec3u",
            label_en: "Reorder levels",
            hint_vi:
                "M\u1ed7i m\u00f3n xu\u1ed1ng c\u00f2n bao nhi\u00eau th\u00ec c\u1ea7n nh\u1eadp, nh\u1eadp bao nhi\u00eau m\u1ed7i l\u1ea7n.",
            hint_en: "At what level each item needs restocking and the usual order quantity.",
        },
        {
            key: "suppliers",
            label_vi: "Nh\u00e0 cung c\u1ea5p",
            label_en: "Suppliers",
            hint_vi:
                "Mua c\u1ee7a ai, li\u00ean h\u1ec7 th\u1ebf n\u00e0o, th\u1eddi gian giao, \u0111i\u1ec1u ki\u1ec7n thanh to\u00e1n.",
            hint_en: "Who you buy from, how to reach them, lead times and payment terms.",
        },
        {
            key: "approval_thresholds",
            label_vi: "Ng\u01b0\u1ee1ng c\u1ea7n duy\u1ec7t",
            label_en: "Approval thresholds",
            hint_vi:
                "\u0110\u01a1n nh\u1eadp t\u1eeb bao nhi\u00eau ti\u1ec1n th\u00ec c\u1ea7n b\u1ea1n duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi.",
            hint_en: "Order value above which you approve before it is sent.",
        },
        {
            key: "stock_count",
            label_vi: "C\u00e1ch ki\u1ec3m k\u00ea",
            label_en: "Stock counting",
            hint_vi:
                "Ai ki\u1ec3m kho, bao l\u00e2u m\u1ed9t l\u1ea7n, ch\u00eanh l\u1ec7ch bao nhi\u00eau th\u00ec ph\u1ea3i b\u00e1o.",
            hint_en: "Who counts, how often, and what difference must be reported.",
        },
        {
            key: "tone",
            label_vi: "Gi\u1ecdng \u0111i\u1ec7u",
            label_en: "Tone",
            hint_vi: "C\u00e1ch x\u01b0ng h\u00f4 v\u00e0 phong c\u00e1ch khi nh\u1eafn tin.",
            hint_en: "How it addresses people and the style of its messages.",
        },
    ],
    authorityActions: [
        {
            action: "draft_purchase_order",
            label: {
                vi: "So\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng",
                en: "Draft a purchase order",
            },
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "send_purchase_order",
            label: {
                vi: "G\u1eedi \u0111\u01a1n nh\u1eadp cho nh\u00e0 cung c\u1ea5p",
                en: "Send a purchase order",
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
            action: "adjust_stock",
            label: {
                vi: "Ch\u1ec9nh s\u1ed1 t\u1ed3n kho",
                en: "Adjust stock",
            },
            mode: "ask",
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
            command: "draft_purchase_order",
            action: "draft_purchase_order",
            subjectType: "purchase_order",
            requiredFields: [],
            description: {
                vi: "so\u1ea1n \u0111\u01a1n nh\u1eadp h\u00e0ng",
                en: "draft a purchase order",
            },
        },
        {
            command: "send_purchase_order",
            action: "send_purchase_order",
            subjectType: "purchase_order",
            requiredFields: ["subject_id"],
            description: {
                vi: "g\u1eedi \u0111\u01a1n nh\u1eadp cho nh\u00e0 cung c\u1ea5p",
                en: "send the purchase order",
            },
        },
        {
            command: "adjust_stock",
            action: "adjust_stock",
            subjectType: "stock",
            requiredFields: ["subject_id"],
            description: {
                vi: "ch\u1ec9nh s\u1ed1 t\u1ed3n kho",
                en: "adjust the stock",
            },
        },
    ],
}
