import type { ModuleDef } from "./catalog.types"

type ShiftsShape = {
    key: "shifts"
    order: number
    icon: string
    glyph: "moduleShifts"
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
              action: "publish_schedule"
              mode: "ask"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "approve_swap"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "approve_leave"
              mode: "ask"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "remind_shift"
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
              action: "publish_schedule"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "approve_swap"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "approve_leave"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "remind_shift"
              subjectType: string
              requiredFields: never[]
          }
    )[]
}

/** The shifts module. */
export const SHIFTS: ShiftsShape = {
    key: "shifts",
    order: 40,
    icon: "review",
    glyph: "moduleShifts",
    mascot: "/images/agents/shifts.png",
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
