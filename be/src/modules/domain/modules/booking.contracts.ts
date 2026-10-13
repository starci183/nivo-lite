import type { ModuleDefinition } from "./modules.contracts"

/** The booking module: its copy, agent, setup gates, authority actions and accepted commands. */
export const BOOKING_MODULE: ModuleDefinition = {
    key: "booking",
    order: 50,
    name: {
        vi: "\u0110\u1eb7t l\u1ecbch h\u1eb9n",
        en: "Appointment booking",
    },
    shortName: {
        vi: "\u0110\u1eb7t l\u1ecbch AI",
        en: "Booking AI",
    },
    description: {
        vi: "Nh\u1eadn l\u1ecbch h\u1eb9n c\u1ee7a kh\u00e1ch, x\u1ebfp v\u00e0o ch\u1ed7 tr\u1ed1ng, \u0111\u1ed5i l\u1ecbch v\u00e0 nh\u1eafc tr\u01b0\u1edbc gi\u1edd h\u1eb9n; chuy\u1ec7n thu ph\u00ed h\u1ee7y do b\u1ea1n quy\u1ebft.",
        en: "Takes customer appointments, fits them into free slots, reschedules and reminds before the visit; cancellation fees stay your call.",
    },
    points: {
        vi: [
            "X\u1ebfp l\u1ecbch h\u1eb9n v\u00e0o ch\u1ed7 c\u00f2n tr\u1ed1ng",
            "\u0110\u1ed5i l\u1ecbch v\u00e0 nh\u1eafc tr\u01b0\u1edbc gi\u1edd h\u1eb9n",
            "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi thu ph\u00ed h\u1ee7y",
        ],
        en: [
            "Fits appointments into free slots",
            "Reschedules and sends reminders",
            "Asks you before charging a cancellation fee",
        ],
    },
    purpose:
        "an appointment-booking assistant that books customers into free slots, reschedules and sends reminders, and asks the owner before charging a cancellation fee",
    icon: "saved",
    glyph: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M9 14h2v2H9z",
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
    agent: {
        name: "Booking Agent",
        handle: "booking",
        summary: {
            vi: "Nh\u1eadn l\u1ecbch h\u1eb9n c\u1ee7a kh\u00e1ch, x\u1ebfp v\u00e0o ch\u1ed7 tr\u1ed1ng, \u0111\u1ed5i l\u1ecbch v\u00e0 nh\u1eafc tr\u01b0\u1edbc gi\u1edd h\u1eb9n; chuy\u1ec7n thu ph\u00ed h\u1ee7y do b\u1ea1n quy\u1ebft.",
            en: "Takes customer appointments, fits them into free slots, reschedules and reminds before the visit; cancellation fees stay your call.",
        },
        capabilities: {
            vi: [
                "X\u1ebfp l\u1ecbch h\u1eb9n v\u00e0o ch\u1ed7 c\u00f2n tr\u1ed1ng",
                "\u0110\u1ed5i l\u1ecbch v\u00e0 nh\u1eafc tr\u01b0\u1edbc gi\u1edd h\u1eb9n",
                "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi thu ph\u00ed h\u1ee7y",
            ],
            en: [
                "Fits appointments into free slots",
                "Reschedules and sends reminders",
                "Asks you before charging a cancellation fee",
            ],
        },
        role: {
            vi: "Nh\u1eadn v\u00e0 qu\u1ea3n l\u00fd l\u1ecbch h\u1eb9n c\u1ee7a kh\u00e1ch",
            en: "Takes and manages customer appointments",
        },
        instructions: {
            vi: "H\u1ecfi kh\u00e1ch mu\u1ed1n \u0111\u1eb7t d\u1ecbch v\u1ee5 g\u00ec, ng\u00e0y gi\u1edd n\u00e0o, r\u1ed3i \u0111\u1ed1i chi\u1ebfu l\u1ecbch tr\u1ed1ng. Ch\u1ec9 x\u00e1c nh\u1eadn khi c\u00f2n ch\u1ed7. Kh\u00f4ng h\u1ee9a ho\u00e0n ti\u1ec1n hay mi\u1ec5n ph\u00ed h\u1ee7y.",
            en: "Ask the customer which service and when, then check free slots. Confirm only when there is room. Never promise refunds or free cancellation.",
        },
    },
    gates: [
        {
            key: "services",
            label_vi: "D\u1ecbch v\u1ee5 v\u00e0 th\u1eddi l\u01b0\u1ee3ng",
            label_en: "Services and duration",
            hint_vi:
                "C\u00e1c d\u1ecbch v\u1ee5 nh\u1eadn \u0111\u1eb7t, m\u1ed7i d\u1ecbch v\u1ee5 m\u1ea5t bao l\u00e2u v\u00e0 gi\u00e1.",
            hint_en: "The services you book, how long each takes and its price.",
        },
        {
            key: "capacity",
            label_vi: "S\u1ee9c ch\u1ee9a v\u00e0 ng\u01b0\u1eddi th\u1ef1c hi\u1ec7n",
            label_en: "Capacity and providers",
            hint_vi:
                "C\u00f9ng l\u00fac nh\u1eadn \u0111\u01b0\u1ee3c m\u1ea5y kh\u00e1ch, ai ho\u1eb7c ph\u00f2ng n\u00e0o th\u1ef1c hi\u1ec7n.",
            hint_en: "How many customers at once, and who or which room delivers.",
        },
        {
            key: "hours_buffer",
            label_vi: "Gi\u1edd nh\u1eadn l\u1ecbch v\u00e0 kho\u1ea3ng ngh\u1ec9",
            label_en: "Booking hours and buffers",
            hint_vi:
                "Khung gi\u1edd nh\u1eadn l\u1ecbch, kho\u1ea3ng ngh\u1ec9 gi\u1eefa hai l\u1ecbch, \u0111\u1eb7t tr\u01b0\u1edbc t\u1ed1i thi\u1ec3u bao l\u00e2u.",
            hint_en: "Bookable hours, buffer between visits, minimum lead time.",
        },
        {
            key: "cancel_policy",
            label_vi: "Ch\u00ednh s\u00e1ch \u0111\u1ed5i v\u00e0 h\u1ee7y l\u1ecbch",
            label_en: "Reschedule and cancellation policy",
            hint_vi:
                "\u0110\u1ed5i l\u1ecbch tr\u01b0\u1edbc bao l\u00e2u th\u00ec mi\u1ec5n ph\u00ed, khi n\u00e0o thu ph\u00ed v\u00e0 bao nhi\u00eau.",
            hint_en: "How late a change is free, when a fee applies and how much.",
        },
        {
            key: "reminders",
            label_vi: "C\u00e1ch nh\u1eafc l\u1ecbch",
            label_en: "Reminders",
            hint_vi: "Nh\u1eafc tr\u01b0\u1edbc bao l\u00e2u, qua k\u00eanh n\u00e0o, n\u1ed9i dung ra sao.",
            hint_en: "How long before, over which channel, and what they say.",
        },
        {
            key: "handoff",
            label_vi: "Khi n\u00e0o chuy\u1ec3n cho ng\u01b0\u1eddi",
            label_en: "Handoff rules",
            hint_vi:
                "T\u00ecnh hu\u1ed1ng n\u00e0o ph\u1ea3i chuy\u1ec3n cho nh\u00e2n vi\u00ean: kh\u00e1ch kh\u00f3, \u0111o\u00e0n \u0111\u00f4ng, y\u00eau c\u1ea7u \u0111\u1eb7c bi\u1ec7t.",
            hint_en: "When a person must take over: difficult requests, groups, special needs.",
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
            action: "confirm_booking",
            label: {
                vi: "X\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n",
                en: "Confirm booking",
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
            action: "reschedule",
            label: {
                vi: "\u0110\u1ed5i l\u1ecbch h\u1eb9n",
                en: "Reschedule",
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
            action: "cancel_with_fee",
            label: {
                vi: "H\u1ee7y l\u1ecbch c\u00f3 thu ph\u00ed",
                en: "Cancel with a fee",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "cancel_booking",
            label: {
                vi: "H\u1ee7y l\u1ecbch h\u1eb9n",
                en: "Cancel booking",
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
            action: "remind_booking",
            label: {
                vi: "Nh\u1eafc l\u1ecbch h\u1eb9n",
                en: "Remind about a booking",
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
            command: "confirm_booking",
            action: "confirm_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n",
                en: "confirm the booking",
            },
        },
        {
            command: "reschedule",
            action: "reschedule",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "\u0111\u1ed5i l\u1ecbch h\u1eb9n",
                en: "reschedule the booking",
            },
        },
        {
            command: "cancel_with_fee",
            action: "cancel_with_fee",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "h\u1ee7y l\u1ecbch h\u1eb9n c\u00f3 thu ph\u00ed",
                en: "cancel the booking with a fee",
            },
        },
        {
            command: "cancel_booking",
            action: "cancel_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "h\u1ee7y l\u1ecbch h\u1eb9n",
                en: "cancel the booking",
            },
        },
        {
            command: "remind_booking",
            action: "remind_booking",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "nh\u1eafc l\u1ecbch h\u1eb9n",
                en: "remind about the booking",
            },
        },
    ],
}
