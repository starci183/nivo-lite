import type { TemplateDefinition } from "./automation-templates.contracts"

/** The shifts templates the engine runs itself, in file-name order. */
export const SHIFTS_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 25,
        key: "shifts_leave_gap",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "shifts",
        icon: "calendar",
        name: {
            vi: "B\u00e1o thi\u1ebfu ng\u01b0\u1eddi khi c\u00f3 ng\u01b0\u1eddi xin ngh\u1ec9",
            en: "Gap alert when someone asks for leave",
        },
        description: {
            vi: "Khi nh\u00e2n vi\u00ean xin ngh\u1ec9, b\u00e1o ch\u1ee7 ngay ca n\u00e0o s\u1ebd thi\u1ebfu ng\u01b0\u1eddi v\u00e0 g\u1ee3i \u00fd h\u1ecfi ai thay.",
            en: "When someone asks for leave, tells the owner right away which shifts would be short and who could cover.",
        },
        trigger: {
            kind: "event",
            event: "leave.requested",
            line: {
                vi: "Khi c\u00f3 \u0111\u01a1n xin ngh\u1ec9 m\u1edbi",
                en: "When a new leave request arrives",
            },
        },
        requires: {
            modules: ["shifts"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 b\u00e1o ch\u1ee7 v\u00e0 g\u1ee3i \u00fd ng\u01b0\u1eddi r\u1ea3nh theo l\u1ecbch v\u00e0 quy t\u1eafc \u0111\u00e3 \u0111\u1eb7t; kh\u00f4ng t\u1ef1 duy\u1ec7t ngh\u1ec9 hay t\u1ef1 g\u1ecdi ng\u01b0\u1eddi thay.",
                en: "Only tells the owner and suggests free people by schedule and rules; never approves leave or calls a replacement itself.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {},
    },
    {
        position: 26,
        key: "shifts_month_close",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "shifts",
        icon: "ledger",
        name: {
            vi: "Ch\u1ed1t c\u00f4ng th\u00e1ng g\u1eedi K\u1ebf to\u00e1n",
            en: "Monthly hours close for Accounting",
        },
        description: {
            vi: "\u0110\u1ea7u th\u00e1ng t\u1ed5ng h\u1ee3p gi\u1edd l\u00e0m \u00d7 l\u01b0\u01a1ng theo gi\u1edd c\u1ee7a t\u1eebng ng\u01b0\u1eddi; g\u1eedi v\u00e0o Office v\u00e0 file CSV qua email c\u1ee7a ch\u1ee7 n\u1ebfu \u0111\u00e3 c\u00f3 email.",
            en: "At the start of the month, sums hours \u00d7 hourly wage per person and sends it to Office and, when mail is set up, a CSV to the owner.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.monthly",
            line: {
                vi: "M\u1ed7i th\u00e1ng v\u00e0o ng\u00e0y v\u00e0 gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every month on the day and time you pick (Vietnam time)",
            },
        },
        requires: {
            modules: ["shifts"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "day",
                kind: "number",
                min: 1,
                max: 28,
                label: {
                    vi: "Ng\u00e0y trong th\u00e1ng",
                    en: "Day of the month",
                },
            },
            {
                key: "time",
                kind: "time",
                label: {
                    vi: "G\u1eedi l\u00fac",
                    en: "Send at",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng gi\u1edd trong l\u1ecbch \u0111\u00e3 \u0111\u0103ng v\u00e0 l\u01b0\u01a1ng theo gi\u1edd \u0111\u00e3 nh\u1eadp; kh\u00f4ng t\u1ef1 chuy\u1ec3n ti\u1ec1n hay tr\u1ea3 l\u01b0\u01a1ng.",
                en: "Only uses hours in published schedules and the hourly wages entered; never moves money or pays wages.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            day: 1,
            time: "09:00",
        },
    },
    {
        position: 24,
        key: "shifts_shift_reminder",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "shifts",
        icon: "calendar",
        name: {
            vi: "Nh\u1eafc ca tr\u01b0\u1edbc gi\u1edd",
            en: "Shift reminders",
        },
        description: {
            vi: "Nh\u1eafc nh\u00e2n vi\u00ean tr\u01b0\u1edbc gi\u1edd v\u00e0o ca, v\u00e0 b\u00e1o ch\u1ee7 n\u1ebfu c\u00f3 ng\u01b0\u1eddi ch\u01b0a v\u00e0o ca sau v\u00e0i ph\u00fat.",
            en: "Reminds staff before a shift and alerts the owner when someone has not checked in a few minutes after it started.",
        },
        trigger: {
            kind: "event",
            event: "shift.upcoming",
            line: {
                vi: "M\u1ed9t kho\u1ea3ng th\u1eddi gian tr\u01b0\u1edbc m\u1ed7i ca \u0111\u00e3 \u0111\u0103ng",
                en: "A while before every published shift",
            },
        },
        requires: {
            modules: ["shifts"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "beforeMinutes",
                kind: "number",
                min: 10,
                max: 240,
                suffix: {
                    vi: "ph\u00fat",
                    en: "minutes",
                },
                label: {
                    vi: "Nh\u1eafc tr\u01b0\u1edbc gi\u1edd v\u00e0o ca",
                    en: "Remind before the shift",
                },
            },
            {
                key: "noShowMinutes",
                kind: "number",
                min: 5,
                max: 60,
                suffix: {
                    vi: "ph\u00fat",
                    en: "minutes",
                },
                label: {
                    vi: "B\u00e1o ch\u1ee7 n\u1ebfu ch\u01b0a v\u00e0o ca sau",
                    en: "Alert the owner if not checked in after",
                },
                hint: {
                    vi: "Ch\u1ec9 t\u00ednh v\u1edbi ng\u01b0\u1eddi \u0111\u00e3 \u0111\u01b0\u1ee3c x\u1ebfp ca; nh\u00e2n vi\u00ean b\u1ea5m V\u00e0o ca trong L\u1ecbch c\u1ee7a t\u00f4i.",
                    en: "Only for people scheduled; staff tap V\u00e0o ca in their schedule.",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 nh\u1eafc \u0111\u00fang ca \u0111\u00e3 \u0111\u0103ng, \u0111\u00fang gi\u1edd v\u00e0 v\u1ecb tr\u00ed trong l\u1ecbch; kh\u00f4ng th\u00eam h\u1ee9a h\u1eb9n hay thay \u0111\u1ed5i l\u1ecbch.",
                en: "Only reminds about published shifts with their real time and position; never promises or changes the schedule.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            beforeMinutes: 60,
            noShowMinutes: 10,
        },
    },
]
