import type { TemplateDefinition } from "./automation-templates.contracts"

/** The inventory templates the engine runs itself, in file-name order. */
export const INVENTORY_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 16,
        key: "inventory_low_stock",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "cart",
        name: {
            vi: "C\u1ea3nh b\u00e1o s\u1eafp h\u1ebft h\u00e0ng",
            en: "Low-stock alert",
        },
        description: {
            vi: "M\u1ed7i ng\u00e0y ki\u1ec3m kho m\u1ed9t l\u1ea7n: m\u00f3n n\u00e0o ch\u1ea1m m\u1ee9c t\u1ed1i thi\u1ec3u th\u00ec so\u1ea1n s\u1eb5n \u0111\u01a1n nh\u1eadp theo nh\u00e0 cung c\u1ea5p v\u00e0 ch\u1edd b\u1ea1n duy\u1ec7t.",
            en: "Checks stock once a day: items at their minimum get a purchase order drafted per supplier and wait for your approval.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every day at the time you pick (Vietnam time)",
            },
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: {
                    vi: "Ki\u1ec3m kho l\u00fac",
                    en: "Check at",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 so\u1ea1n \u0111\u01a1n nh\u00e1p; g\u1eedi cho nh\u00e0 cung c\u1ea5p lu\u00f4n ch\u1edd b\u1ea1n duy\u1ec7t.",
                en: "Only drafts orders; sending to a supplier always waits for you.",
            },
            {
                vi: "Kh\u00f4ng \u0111\u1eb7t m\u00f3n \u0111\u00e3 c\u00f3 \u0111\u01a1n nh\u1eadp \u0111ang ch\u1edd giao.",
                en: "Never orders an item that already has an open purchase order.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "07:30",
        },
    },
    {
        position: 18,
        key: "inventory_supplier_overdue",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "truck",
        name: {
            vi: "Nh\u1eafc nh\u00e0 cung c\u1ea5p giao tr\u1ec5",
            en: "Overdue supplier reminder",
        },
        description: {
            vi: "\u0110\u01a1n \u0111\u00e3 g\u1eedi m\u00e0 qu\u00e1 h\u1ea1n giao: so\u1ea1n s\u1eb5n tin nh\u1eafc nh\u1eb9 nh\u00e0 cung c\u1ea5p, b\u1ea1n duy\u1ec7t m\u1edbi g\u1eedi (nh\u1eafc t\u1ed1i \u0111a 2 l\u1ea7n).",
            en: "A sent order past its delivery date: a polite reminder to the supplier is drafted and goes out only after you approve (at most 2 reminders).",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every day at the time you pick (Vietnam time)",
            },
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: {
                    vi: "Ki\u1ec3m l\u00fac",
                    en: "Check at",
                },
            },
            {
                key: "graceDays",
                kind: "number",
                min: 0,
                max: 30,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Nh\u1eafc khi tr\u1ec5 h\u01a1n",
                    en: "Remind when later than",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Tin nh\u1eafc l\u1ecbch s\u1ef1, kh\u00f4ng tr\u00e1ch m\u00f3c; lu\u00f4n ch\u1edd b\u1ea1n duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi.",
                en: "Polite, never blaming; always waits for your approval before sending.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "09:00",
            graceDays: 1,
        },
    },
    {
        position: 17,
        key: "inventory_weekly_report",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "inventory",
        icon: "report",
        name: {
            vi: "B\u00e1o c\u00e1o t\u1ed3n kho cu\u1ed1i tu\u1ea7n",
            en: "Weekend stock report",
        },
        description: {
            vi: "Chi\u1ec1u Ch\u1ee7 nh\u1eadt: gi\u00e1 tr\u1ecb t\u1ed3n kho, m\u00f3n s\u1eafp h\u1ebft, h\u00e0ng nh\u1eadp xu\u1ea5t trong tu\u1ea7n v\u00e0 \u0111\u01a1n nh\u1eadp \u0111ang m\u1edf.",
            en: "Sunday afternoon: stock value, items running low, the week's stock in and out and open purchase orders.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "Ch\u1ee7 nh\u1eadt h\u1eb1ng tu\u1ea7n v\u00e0o gi\u1edd b\u1ea1n ch\u1ecdn (gi\u1edd Vi\u1ec7t Nam)",
                en: "Every Sunday at the time you pick (Vietnam time)",
            },
        },
        requires: {
            modules: ["inventory"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "time",
                kind: "time",
                label: {
                    vi: "G\u1eedi l\u00fac",
                    en: "Send at",
                },
            },
            {
                key: "email",
                kind: "email",
                label: {
                    vi: "G\u1eedi th\u00eam t\u1edbi email",
                    en: "Also email to",
                },
                hint: {
                    vi: "\u0110\u1ec3 tr\u1ed1ng n\u1ebfu ch\u1ec9 c\u1ea7n xem trong V\u0103n ph\u00f2ng.",
                    en: "Leave empty to see it in Office only.",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng s\u1ed1 li\u1ec7u c\u00f3 th\u1eadt trong kho.",
                en: "Only real stock figures.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "17:00",
            email: "",
        },
    },
]
