import type { ModuleDef } from "./catalog.types"

type BookingShape = {
    key: "booking"
    order: number
    icon: string
    glyph: "moduleBooking"
    mascot: string
    category: "operations"
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
    multiInstance: true
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "confirm_booking"
              mode: "auto"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "reschedule"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "cancel_with_fee"
              mode: "ask"
              limitVnd: null
              requiredFields: never[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "cancel_booking"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "remind_booking"
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
              action: "confirm_booking"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "reschedule"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "cancel_with_fee"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "cancel_booking"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "remind_booking"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The booking module. */
export const BOOKING: BookingShape = {
    key: "booking",
    order: 50,
    icon: "saved",
    glyph: "moduleBooking",
    mascot: "/images/agents/booking.png",
    category: "operations",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "booking",
    workbench: "booking",
    settingsExtras: null,
    requires: {
        capabilities: ["customer_chat", "calendar"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    gates: [
        {
            key: "services",
        },
        {
            key: "capacity",
        },
        {
            key: "hours_buffer",
        },
        {
            key: "cancel_policy",
        },
        {
            key: "reminders",
        },
        {
            key: "handoff",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "confirm_booking",
            mode: "auto",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "reschedule",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "cancel_with_fee",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: true,
            maxMode: null,
            next: [],
        },
        {
            action: "cancel_booking",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "remind_booking",
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
            command: "confirm_booking",
            action: "confirm_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "reschedule",
            action: "reschedule",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "cancel_with_fee",
            action: "cancel_with_fee",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "cancel_booking",
            action: "cancel_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
        {
            command: "remind_booking",
            action: "remind_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
        },
    ],
} satisfies ModuleDef
