import type { ModuleDef } from "./catalog.types"

/** The hiring module. */
export const HIRING = {
    key: "hiring",
    order: 100,
    icon: "jobs",
    glyph: "moduleHiring",
    mascot: "/images/agents/hiring.png",
    category: "hr",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "hiring",
    workbench: "hiring",
    settingsExtras: null,
    requires: {
        capabilities: ["email"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "open_roles",
        },
        {
            key: "criteria",
        },
        {
            key: "interview_process",
        },
        {
            key: "offer_rules",
        },
        {
            key: "fairness",
        },
        {
            key: "privacy",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "screen_candidate",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "schedule_interview",
            mode: "auto",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "send_offer",
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
            command: "screen_candidate",
            action: "screen_candidate",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
        },
        {
            command: "schedule_interview",
            action: "schedule_interview",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
        },
        {
            command: "send_offer",
            action: "send_offer",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
        },
    ],
} satisfies ModuleDef
