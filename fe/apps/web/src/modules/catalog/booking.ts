import type { ModuleDef } from "./catalog.types"

/** The booking module. */
export const BOOKING = {
    key: "booking",
    order: 50,
    icon: "saved",
    glyph: "moduleBooking",
    mascot: "/images/promo/mascot-point.png",
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
