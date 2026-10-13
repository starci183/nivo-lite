import type { ModuleDef } from "./catalog.types"

/** The shifts module. */
export const SHIFTS = {
    key: "shifts",
    order: 40,
    name: {
        vi: "L\u1ecbch & ca l\u00e0m",
        en: "Shifts and schedules",
    },
    shortName: {
        vi: "L\u1ecbch ca AI",
        en: "Shifts AI",
    },
    description: {
        vi: "X\u1ebfp l\u1ecbch ca, x\u1eed l\u00fd \u0111\u1ed5i ca v\u00e0 xin ngh\u1ec9, nh\u1eafc nh\u00e2n vi\u00ean tr\u01b0\u1edbc gi\u1edd l\u00e0m; b\u1ea1n ch\u1ec9 duy\u1ec7t nh\u1eefng g\u00ec ngo\u00e0i quy t\u1eafc.",
        en: "Builds shift schedules, handles swaps and leave requests and reminds staff before they start; you only approve what falls outside your rules.",
    },
    points: {
        vi: [
            "So\u1ea1n l\u1ecbch ca theo nhu c\u1ea7u t\u1eebng ng\u00e0y",
            "Duy\u1ec7t \u0111\u1ed5i ca trong quy t\u1eafc \u0111\u00e3 \u0111\u1eb7t",
            "Nh\u1eafc nh\u00e2n vi\u00ean tr\u01b0\u1edbc gi\u1edd v\u00e0o ca",
        ],
        en: [
            "Drafts schedules from daily demand",
            "Approves swaps within your rules",
            "Reminds staff before each shift",
        ],
    },
    purpose:
        "a shift-scheduling assistant that drafts schedules, handles shift swaps and leave requests within the owner's rules and reminds staff before their shifts",
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
    agent: {
        name: "Shifts Agent",
        handle: "shifts",
        summary: {
            vi: "X\u1ebfp l\u1ecbch ca, x\u1eed l\u00fd \u0111\u1ed5i ca v\u00e0 xin ngh\u1ec9, nh\u1eafc nh\u00e2n vi\u00ean tr\u01b0\u1edbc gi\u1edd l\u00e0m; b\u1ea1n ch\u1ec9 duy\u1ec7t nh\u1eefng g\u00ec ngo\u00e0i quy t\u1eafc.",
            en: "Builds shift schedules, handles swaps and leave requests and reminds staff before they start; you only approve what falls outside your rules.",
        },
        capabilities: {
            vi: [
                "So\u1ea1n l\u1ecbch ca theo nhu c\u1ea7u t\u1eebng ng\u00e0y",
                "Duy\u1ec7t \u0111\u1ed5i ca trong quy t\u1eafc \u0111\u00e3 \u0111\u1eb7t",
                "Nh\u1eafc nh\u00e2n vi\u00ean tr\u01b0\u1edbc gi\u1edd v\u00e0o ca",
            ],
            en: [
                "Drafts schedules from daily demand",
                "Approves swaps within your rules",
                "Reminds staff before each shift",
            ],
        },
        role: {
            vi: "L\u00ean l\u1ecbch ca v\u00e0 x\u1eed l\u00fd \u0111\u1ed5i ca, ngh\u1ec9 ph\u00e9p",
            en: "Plans shifts and handles swaps and leave",
        },
        instructions: {
            vi: "So\u1ea1n l\u1ecbch ca t\u1eeb nhu c\u1ea7u t\u1eebng ng\u00e0y, ki\u1ec3m tra quy t\u1eafc, \u0111\u1ec1 xu\u1ea5t vi\u1ec7c c\u1ea7n ch\u1ee7 duy\u1ec7t. Kh\u00f4ng t\u1ef1 \u0111\u0103ng l\u1ecbch khi ch\u01b0a \u0111\u01b0\u1ee3c c\u1ea5p quy\u1ec1n.",
            en: "Draft the shift schedule from daily demand, check it against the rules and propose what needs the owner. Never publish a schedule without authority.",
        },
    },
    gates: [
        {
            key: "staff_roles",
            label_vi: "Nh\u00e2n s\u1ef1 v\u00e0 vai tr\u00f2",
            label_en: "Staff and roles",
            hint_vi:
                "C\u00f3 nh\u1eefng ai, m\u1ed7i ng\u01b0\u1eddi l\u00e0m vai tr\u00f2 g\u00ec, ai \u0111\u01b0\u1ee3c ph\u00e9p l\u00e0m ca n\u00e0o.",
            hint_en: "Who works here, in what role, and who may cover which shift.",
        },
        {
            key: "opening_hours",
            label_vi: "Gi\u1edd ho\u1ea1t \u0111\u1ed9ng",
            label_en: "Operating hours",
            hint_vi:
                "Gi\u1edd m\u1edf c\u1eeda v\u00e0 \u0111\u00f3ng c\u1eeda t\u1eebng ng\u00e0y trong tu\u1ea7n, ng\u00e0y ngh\u1ec9 c\u1ed1 \u0111\u1ecbnh.",
            hint_en: "Opening and closing hours each weekday and fixed days off.",
        },
        {
            key: "coverage",
            label_vi: "S\u1ed1 ng\u01b0\u1eddi t\u1ed1i thi\u1ec3u m\u1ed7i ca",
            label_en: "Minimum coverage",
            hint_vi: "M\u1ed7i ca, m\u1ed7i vai tr\u00f2 c\u1ea7n t\u1ed1i thi\u1ec3u bao nhi\u00eau ng\u01b0\u1eddi.",
            hint_en: "How many people each shift and role needs at minimum.",
        },
        {
            key: "swap_leave_rules",
            label_vi: "Quy t\u1eafc \u0111\u1ed5i ca v\u00e0 xin ngh\u1ec9",
            label_en: "Swap and leave rules",
            hint_vi:
                "B\u00e1o tr\u01b0\u1edbc bao l\u00e2u, \u0111\u1ed5i ca c\u1ea7n \u0111i\u1ec1u ki\u1ec7n g\u00ec, ai duy\u1ec7t ngh\u1ec9.",
            hint_en: "How much notice, what a swap needs, who approves leave.",
        },
        {
            key: "labor_limits",
            label_vi: "Gi\u1edbi h\u1ea1n gi\u1edd l\u00e0m",
            label_en: "Working-time limits",
            hint_vi:
                "S\u1ed1 gi\u1edd t\u1ed1i \u0111a m\u1ed7i ng\u00e0y v\u00e0 tu\u1ea7n, th\u1eddi gian ngh\u1ec9 gi\u1eefa hai ca, l\u01b0\u01a1ng theo gi\u1edd c\u1ee7a t\u1eebng v\u1ecb tr\u00ed ho\u1eb7c ng\u01b0\u1eddi.",
            hint_en: "Maximum hours per day and week, rest between shifts, and the hourly wage per role or person.",
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
            action: "publish_schedule",
            label: {
                vi: "\u0110\u0103ng l\u1ecbch ca",
                en: "Publish schedule",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "approve_swap",
            label: {
                vi: "Duy\u1ec7t \u0111\u1ed5i ca",
                en: "Approve shift swap",
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
            action: "approve_leave",
            label: {
                vi: "Duy\u1ec7t xin ngh\u1ec9",
                en: "Approve leave",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "remind_shift",
            label: {
                vi: "Nh\u1eafc ca l\u00e0m",
                en: "Remind staff of a shift",
            },
            mode: "auto",
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
            command: "publish_schedule",
            action: "publish_schedule",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "\u0111\u0103ng l\u1ecbch ca",
                en: "publish the schedule",
            },
        },
        {
            command: "approve_swap",
            action: "approve_swap",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "duy\u1ec7t \u0111\u1ed5i ca",
                en: "approve the swap",
            },
        },
        {
            command: "approve_leave",
            action: "approve_leave",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "duy\u1ec7t xin ngh\u1ec9",
                en: "approve the leave",
            },
        },
        {
            command: "remind_shift",
            action: "remind_shift",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "nh\u1eafc ca l\u00e0m",
                en: "remind about the shift",
            },
        },
    ],
} satisfies ModuleDef
