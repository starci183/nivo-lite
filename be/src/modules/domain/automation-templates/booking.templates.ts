import type { TemplateDefinition } from "./automation-templates.contracts"

/** The booking templates the engine runs itself, in file-name order. */
export const BOOKING_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 9,
        key: "appointment_reminder",
        version: 2,
        pack: "appointments",
        executor: "implemented",
        moduleKey: "booking",
        icon: "calendar",
        name: {
            vi: "Nh\u1eafc l\u1ecbch h\u1eb9n",
            en: "Appointment reminders",
        },
        description: {
            vi: "NIVO \u0111\u00e3 t\u1ef1 nh\u1eafc kh\u00e1ch 24 gi\u1edd v\u00e0 2 gi\u1edd tr\u01b0\u1edbc gi\u1edd h\u1eb9n. B\u1eadt th\u1ebb n\u00e0y \u0111\u1ec3 \u0111\u1ed5i m\u1ed1c gi\u1edd v\u00e0 l\u1eddi nh\u1eafn theo c\u00e1ch c\u1ee7a b\u1ea1n.",
            en: "NIVO already reminds customers 24 hours and 2 hours before. Turn this card on to change the timing and the wording.",
        },
        trigger: {
            kind: "schedule",
            event: "booking.upcoming",
            line: {
                vi: "M\u1ed9t kho\u1ea3ng th\u1eddi gian tr\u01b0\u1edbc gi\u1edd h\u1eb9n",
                en: "A while before the appointment",
            },
        },
        requires: {
            modules: ["booking"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_appointments"],
        },
        settings: [
            {
                key: "firstHours",
                kind: "number",
                min: 1,
                max: 72,
                suffix: {
                    vi: "gi\u1edd",
                    en: "hours",
                },
                label: {
                    vi: "Nh\u1eafc l\u1ea7n 1 tr\u01b0\u1edbc",
                    en: "First reminder before",
                },
            },
            {
                key: "secondHours",
                kind: "number",
                min: 0,
                max: 24,
                suffix: {
                    vi: "gi\u1edd (0 = t\u1eaft)",
                    en: "hours (0 = off)",
                },
                label: {
                    vi: "Nh\u1eafc l\u1ea7n 2 tr\u01b0\u1edbc",
                    en: "Second reminder before",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "dich_vu", "gio_hen", "nguoi_lam", "dia_chi"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, {ten_shop} nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch {dich_vu} l\u00fac {gio_hen}. B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            en: "Hi {ten_khach}, a reminder from {ten_shop}: {dich_vu} at {gio_hen}.",
        },
        authority: {
            action: "remind_booking",
        },
        defaults: {
            firstHours: 24,
            secondHours: 2,
        },
    },
    {
        position: 11,
        key: "booking_comeback",
        version: 1,
        pack: "appointments",
        executor: "implemented",
        moduleKey: "booking",
        icon: "winback",
        name: {
            vi: "M\u1eddi kh\u00e1ch quay l\u1ea1i theo d\u1ecbch v\u1ee5",
            en: "Invite customers back by service",
        },
        description: {
            vi: "Sau s\u1ed1 ng\u00e0y b\u1ea1n \u0111\u1eb7t cho t\u1eebng d\u1ecbch v\u1ee5 (v\u00ed d\u1ee5 c\u1eaft t\u00f3c 30 ng\u00e0y, nh\u1ed5 r\u0103ng 180 ng\u00e0y), NIVO m\u1eddi kh\u00e1ch \u0111\u1eb7t l\u1ecbch l\u1ea7n ti\u1ebfp theo. Kh\u00e1ch \u0111\u00e3 c\u00f3 l\u1ecbch s\u1eafp t\u1edbi th\u00ec kh\u00f4ng nh\u1eafn.",
            en: "After the number of days you set per service, NIVO invites the customer to book again.",
        },
        trigger: {
            kind: "schedule",
            event: "booking.followup",
            line: {
                vi: "S\u1ed1 ng\u00e0y sau bu\u1ed5i h\u1eb9n, t\u00ednh theo t\u1eebng d\u1ecbch v\u1ee5",
                en: "N days after the visit, per service",
            },
        },
        requires: {
            modules: ["booking"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_appointments"],
        },
        settings: [],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "dich_vu", "so_ngay"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, \u0111\u00e3 kho\u1ea3ng {so_ngay} ng\u00e0y k\u1ec3 t\u1eeb l\u1ea7n {dich_vu} t\u1ea1i {ten_shop}. B\u1ea1n mu\u1ed1n \u0111\u1eb7t l\u1ecbch l\u1ea7n ti\u1ebfp theo kh\u00f4ng \u1ea1? B\u1ea1n nh\u1eafn ng\u00e0y gi\u1edd mong mu\u1ed1n, b\u00ean m\u00ecnh gi\u1eef ch\u1ed7 cho b\u1ea1n.",
            en: "Hi {ten_khach}, it has been about {so_ngay} days since your {dich_vu}. Would you like to book again?",
        },
        authority: {
            action: "send_follow_up",
        },
        defaults: {},
    },
    {
        position: 10,
        key: "booking_review",
        version: 1,
        pack: "appointments",
        executor: "implemented",
        moduleKey: "booking",
        icon: "review",
        name: {
            vi: "Xin \u0111\u00e1nh gi\u00e1 sau bu\u1ed5i h\u1eb9n",
            en: "Ask for a review after the visit",
        },
        description: {
            vi: "V\u00e0i gi\u1edd sau khi bu\u1ed5i h\u1eb9n xong, NIVO xin kh\u00e1ch m\u1ed9t l\u1eddi nh\u1eadn x\u00e9t. Kh\u00e1ch ch\u00ea th\u00ec b\u1ea1n \u0111\u01b0\u1ee3c b\u00e1o trong V\u0103n ph\u00f2ng.",
            en: "A few hours after a visit, NIVO asks the customer for feedback.",
        },
        trigger: {
            kind: "schedule",
            event: "booking.done",
            line: {
                vi: "M\u1ed9t kho\u1ea3ng th\u1eddi gian sau khi bu\u1ed5i h\u1eb9n xong",
                en: "A while after the appointment is done",
            },
        },
        requires: {
            modules: ["booking"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_appointments"],
        },
        settings: [
            {
                key: "afterHours",
                kind: "number",
                min: 1,
                max: 72,
                suffix: {
                    vi: "gi\u1edd",
                    en: "hours",
                },
                label: {
                    vi: "H\u1ecfi sau",
                    en: "Ask after",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 xin nh\u1eadn x\u00e9t, kh\u00f4ng xin \u0111\u00e1nh gi\u00e1 5 sao v\u00e0 kh\u00f4ng t\u1eb7ng qu\u00e0.",
                en: "Ask for feedback only, no star-begging and no gifts.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "dich_vu"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, c\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 d\u00f9ng {dich_vu} t\u1ea1i {ten_shop}. B\u1ea1n th\u1ea5y bu\u1ed5i h\u1eb9n th\u1ebf n\u00e0o \u1ea1? M\u1ed9t l\u1eddi nh\u1eadn x\u00e9t ng\u1eafn c\u1ee7a b\u1ea1n gi\u00fap b\u00ean m\u00ecnh r\u1ea5t nhi\u1ec1u.",
            en: "Hi {ten_khach}, thank you for choosing {ten_shop}. How was your visit?",
        },
        authority: {
            action: "send_care",
        },
        defaults: {
            afterHours: 3,
        },
    },
    {
        position: 12,
        key: "booking_waitlist_notice",
        version: 1,
        pack: "appointments",
        executor: "implemented",
        moduleKey: "booking",
        icon: "calendar",
        name: {
            vi: "B\u00e1o ch\u1ed7 tr\u1ed1ng cho kh\u00e1ch \u0111ang ch\u1edd",
            en: "Tell waiting customers about a free slot",
        },
        description: {
            vi: "Khi l\u1ecbch c\u00f3 ch\u1ed7 tr\u1ed1ng \u0111\u00fang khung gi\u1edd kh\u00e1ch \u0111ang ch\u1edd (c\u00f3 ng\u01b0\u1eddi h\u1ee7y ho\u1eb7c \u0111\u1ed5i l\u1ecbch), NIVO b\u00e1o kh\u00e1ch ngay.",
            en: "When a slot opens in the window a waiting customer asked for, NIVO tells them.",
        },
        trigger: {
            kind: "schedule",
            event: "booking.slot_free",
            line: {
                vi: "Khi c\u00f3 ch\u1ed7 tr\u1ed1ng trong khung gi\u1edd kh\u00e1ch ch\u1edd",
                en: "When a slot opens in the waiting window",
            },
        },
        requires: {
            modules: ["booking"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_appointments"],
        },
        settings: [],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "dich_vu", "gio_hen"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, {ten_shop} v\u1eeba c\u00f3 ch\u1ed7 tr\u1ed1ng cho {dich_vu} l\u00fac {gio_hen}. B\u1ea1n mu\u1ed1n gi\u1eef l\u1ecbch n\u00e0y th\u00ec nh\u1eafn l\u1ea1i cho b\u00ean m\u00ecnh nh\u00e9.",
            en: "Hi {ten_khach}, {ten_shop} has a free slot for {dich_vu} at {gio_hen}.",
        },
        authority: {
            action: "send_care",
        },
        defaults: {},
    },
]
