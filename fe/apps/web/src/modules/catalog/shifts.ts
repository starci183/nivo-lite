import type { ModuleDef } from "./catalog.types"

/** The shifts module. */
export const SHIFTS = {
    key: "shifts",
    order: 40,
    icon: "review",
    glyph: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3",
    mascot: "/images/promo/mascot-night.png",
    category: "operations",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "shifts",
    workbench: "shifts",
    settingsExtras: null,
    requires: {
        capabilities: ["staff_directory"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "staff_roles",
        },
        {
            key: "opening_hours",
        },
        {
            key: "coverage",
        },
        {
            key: "swap_leave_rules",
        },
        {
            key: "labor_limits",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "publish_schedule",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "approve_swap",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "approve_leave",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "remind_shift",
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
            command: "publish_schedule",
            action: "publish_schedule",
            subjectType: "inbound",
            requiredFields: [],
        },
        {
            command: "approve_swap",
            action: "approve_swap",
            subjectType: "inbound",
            requiredFields: [],
        },
        {
            command: "approve_leave",
            action: "approve_leave",
            subjectType: "inbound",
            requiredFields: [],
        },
        {
            command: "remind_shift",
            action: "remind_shift",
            subjectType: "inbound",
            requiredFields: [],
        },
    ],
} satisfies ModuleDef
