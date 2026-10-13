import type { ModuleDef } from "./catalog.types"

/** The hiring module. */
export const HIRING = {
    key: "hiring",
    order: 100,
    name: {
        vi: "Tuy\u1ec3n d\u1ee5ng",
        en: "Hiring",
    },
    shortName: {
        vi: "Tuy\u1ec3n d\u1ee5ng AI",
        en: "Hiring AI",
    },
    description: {
        vi: "S\u00e0ng l\u1ecdc h\u1ed3 s\u01a1, x\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n v\u00e0 nh\u1eafc \u1ee9ng vi\u00ean; g\u1eedi th\u01b0 m\u1eddi nh\u1eadn vi\u1ec7c lu\u00f4n do b\u1ea1n duy\u1ec7t.",
        en: "Screens candidates, schedules interviews and reminds applicants; sending an offer always waits for you.",
    },
    points: {
        vi: [
            "S\u00e0ng l\u1ecdc h\u1ed3 s\u01a1 theo ti\u00eau ch\u00ed b\u1ea1n \u0111\u1eb7t",
            "X\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n v\u1edbi \u1ee9ng vi\u00ean",
            "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi th\u01b0 m\u1eddi",
        ],
        en: [
            "Screens candidates against your criteria",
            "Schedules interviews with applicants",
            "Asks you before sending an offer",
        ],
    },
    purpose:
        "a hiring assistant that screens candidates against the owner's criteria, schedules interviews and drafts offers for the owner to approve",
    icon: "jobs",
    glyph: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
    mascot: "/images/promo/mascot-point.png",
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
    agent: {
        name: "Hiring Agent",
        handle: "hiring",
        summary: {
            vi: "S\u00e0ng l\u1ecdc h\u1ed3 s\u01a1, x\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n v\u00e0 nh\u1eafc \u1ee9ng vi\u00ean; g\u1eedi th\u01b0 m\u1eddi nh\u1eadn vi\u1ec7c lu\u00f4n do b\u1ea1n duy\u1ec7t.",
            en: "Screens candidates, schedules interviews and reminds applicants; sending an offer always waits for you.",
        },
        capabilities: {
            vi: [
                "S\u00e0ng l\u1ecdc h\u1ed3 s\u01a1 theo ti\u00eau ch\u00ed b\u1ea1n \u0111\u1eb7t",
                "X\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n v\u1edbi \u1ee9ng vi\u00ean",
                "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi th\u01b0 m\u1eddi",
            ],
            en: [
                "Screens candidates against your criteria",
                "Schedules interviews with applicants",
                "Asks you before sending an offer",
            ],
        },
        role: {
            vi: "S\u00e0ng l\u1ecdc \u1ee9ng vi\u00ean v\u00e0 x\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n",
            en: "Screens candidates and schedules interviews",
        },
        instructions: {
            vi: "\u0110\u1ed1i chi\u1ebfu h\u1ed3 s\u01a1 v\u1edbi ti\u00eau ch\u00ed c\u1ee7a v\u1ecb tr\u00ed, ghi l\u00fd do r\u00f5 r\u00e0ng. Kh\u00f4ng \u0111\u00e1nh gi\u00e1 theo gi\u1edbi t\u00ednh, tu\u1ed5i, n\u01a1i sinh hay c\u00e1c y\u1ebfu t\u1ed1 b\u1ecb c\u1ea5m. Kh\u00f4ng t\u1ef1 g\u1eedi th\u01b0 m\u1eddi nh\u1eadn vi\u1ec7c.",
            en: "Match each application to the role criteria and give clear reasons. Never judge by gender, age, origin or other protected traits. Never send an offer by yourself.",
        },
    },
    gates: [
        {
            key: "open_roles",
            label_vi: "V\u1ecb tr\u00ed \u0111ang tuy\u1ec3n",
            label_en: "Open roles",
            hint_vi:
                "C\u00e1c v\u1ecb tr\u00ed c\u1ea7n tuy\u1ec3n, s\u1ed1 l\u01b0\u1ee3ng, n\u01a1i l\u00e0m vi\u1ec7c v\u00e0 m\u1ee9c l\u01b0\u01a1ng d\u1ef1 ki\u1ebfn.",
            hint_en: "Open roles, headcount, location and expected pay.",
        },
        {
            key: "criteria",
            label_vi: "Ti\u00eau ch\u00ed s\u00e0ng l\u1ecdc",
            label_en: "Screening criteria",
            hint_vi:
                "Y\u00eau c\u1ea7u b\u1eaft bu\u1ed9c v\u00e0 \u0111i\u1ec3m c\u1ed9ng cho t\u1eebng v\u1ecb tr\u00ed.",
            hint_en: "Must-haves and nice-to-haves for each role.",
        },
        {
            key: "interview_process",
            label_vi: "Quy tr\u00ecnh ph\u1ecfng v\u1ea5n",
            label_en: "Interview process",
            hint_vi:
                "C\u00f3 m\u1ea5y v\u00f2ng, ai ph\u1ecfng v\u1ea5n, m\u1ed7i v\u00f2ng bao l\u00e2u, khung gi\u1edd ph\u1ecfng v\u1ea5n.",
            hint_en: "How many rounds, who interviews, how long and when.",
        },
        {
            key: "offer_rules",
            label_vi: "Quy t\u1eafc th\u01b0 m\u1eddi",
            label_en: "Offer rules",
            hint_vi:
                "Ai \u0111\u01b0\u1ee3c ph\u00e9p ch\u1ed1t m\u1ee9c l\u01b0\u01a1ng, th\u00f4ng tin g\u00ec ph\u1ea3i c\u00f3 trong th\u01b0 m\u1eddi.",
            hint_en: "Who may set pay and what an offer letter must contain.",
        },
        {
            key: "fairness",
            label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c d\u00f9ng \u0111\u1ec3 lo\u1ea1i",
            label_en: "Fair-screening limits",
            hint_vi:
                "Nh\u1eefng y\u1ebfu t\u1ed1 tuy\u1ec7t \u0111\u1ed1i kh\u00f4ng d\u00f9ng \u0111\u1ec3 \u0111\u00e1nh gi\u00e1 \u1ee9ng vi\u00ean.",
            hint_en: "Traits that must never be used to rate a candidate.",
        },
        {
            key: "privacy",
            label_vi: "B\u1ea3o m\u1eadt h\u1ed3 s\u01a1",
            label_en: "Candidate privacy",
            hint_vi: "L\u01b0u h\u1ed3 s\u01a1 bao l\u00e2u, ai \u0111\u01b0\u1ee3c xem, khi n\u00e0o x\u00f3a.",
            hint_en: "How long files are kept, who sees them and when they are deleted.",
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
            action: "screen_candidate",
            label: {
                vi: "S\u00e0ng l\u1ecdc \u1ee9ng vi\u00ean",
                en: "Screen a candidate",
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
            action: "schedule_interview",
            label: {
                vi: "X\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n",
                en: "Schedule an interview",
            },
            mode: "auto",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "send_offer",
            label: {
                vi: "G\u1eedi th\u01b0 m\u1eddi nh\u1eadn vi\u1ec7c",
                en: "Send a job offer",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
    ],
    accepts: [
        {
            command: "screen_candidate",
            action: "screen_candidate",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
            description: {
                vi: "s\u00e0ng l\u1ecdc \u1ee9ng vi\u00ean",
                en: "screen the candidate",
            },
        },
        {
            command: "schedule_interview",
            action: "schedule_interview",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
            description: {
                vi: "x\u1ebfp l\u1ecbch ph\u1ecfng v\u1ea5n",
                en: "schedule the interview",
            },
        },
        {
            command: "send_offer",
            action: "send_offer",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
            description: {
                vi: "g\u1eedi th\u01b0 m\u1eddi nh\u1eadn vi\u1ec7c",
                en: "send the offer",
            },
        },
    ],
} satisfies ModuleDef
