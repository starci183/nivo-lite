import type { TemplateDefinition } from "./automation-templates.contracts"

/** The messages templates the engine runs itself, in file-name order. */
export const MESSAGES_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 4,
        key: "after_hours",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "chatbot",
        icon: "moon",
        name: {
            vi: "Kh\u00e1ch h\u1ecfi ngo\u00e0i gi\u1edd",
            en: "Messages outside opening hours",
        },
        description: {
            vi: "Kh\u00e1ch nh\u1eafn khi shop \u0111\u00e3 \u0111\u00f3ng c\u1eeda \u0111\u01b0\u1ee3c b\u00e1o s\u1ebd c\u00f3 ng\u01b0\u1eddi g\u1ecdi l\u1ea1i s\u00e1ng mai, v\u00e0 nh\u00e2n vi\u00ean c\u00f3 s\u1eb5n m\u1ed9t vi\u1ec7c c\u1ea7n g\u1ecdi.",
            en: "Customers who write when you are closed are told someone will call back, and staff get a call task.",
        },
        trigger: {
            kind: "event",
            event: "message.outside_hours",
            line: {
                vi: "Khi kh\u00e1ch nh\u1eafn ngo\u00e0i gi\u1edd m\u1edf c\u1eeda",
                en: "When a customer writes outside opening hours",
            },
        },
        requires: {
            modules: ["chatbot"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_opening_hours"],
        },
        settings: [
            {
                key: "openFrom",
                kind: "time",
                label: {
                    vi: "M\u1edf c\u1eeda t\u1eeb",
                    en: "Opens at",
                },
                hint: {
                    vi: "Ch\u1ec9 d\u00f9ng khi NIVO kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c gi\u1edd m\u1edf c\u1eeda t\u1eeb th\u00f4ng tin c\u1eeda h\u00e0ng.",
                    en: "Used only when NIVO cannot read the hours from your shop information.",
                },
            },
            {
                key: "openTo",
                kind: "time",
                label: {
                    vi: "\u0110\u00f3ng c\u1eeda l\u00fac",
                    en: "Closes at",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00f3i s\u1ebd c\u00f3 ng\u01b0\u1eddi g\u1ecdi l\u1ea1i, kh\u00f4ng h\u1eb9n gi\u1edd c\u1ee5 th\u1ec3.",
                en: "Only say someone will call back, no exact time.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "gio_mo_cua"],
        defaultBody: {
            vi: "C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 nh\u1eafn cho {ten_shop}. Hi\u1ec7n shop \u0111\u00e3 ngo\u00e0i gi\u1edd l\u00e0m vi\u1ec7c ({gio_mo_cua}), b\u00ean m\u00ecnh s\u1ebd g\u1ecdi l\u1ea1i cho b\u1ea1n v\u00e0o s\u00e1ng mai nh\u00e9!",
            en: "Thanks for writing to {ten_shop}. We are closed now ({gio_mo_cua}); someone will call you back tomorrow morning.",
        },
        authority: {
            action: "reply_customer",
        },
        defaults: {
            openFrom: "08:00",
            openTo: "21:00",
        },
    },
    {
        position: 5,
        key: "ask_review",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "sales",
        icon: "review",
        name: {
            vi: "Xin \u0111\u00e1nh gi\u00e1",
            en: "Ask for a review",
        },
        description: {
            vi: "Sau khi kh\u00e1ch thanh to\u00e1n, NIVO xin m\u1ed9t l\u1eddi nh\u1eadn x\u00e9t. N\u1ebfu kh\u00e1ch ch\u00ea, b\u1ea1n \u0111\u01b0\u1ee3c b\u00e1o ngay trong V\u0103n ph\u00f2ng.",
            en: "After a customer pays, NIVO asks for feedback. If it is negative, you are told in the Office.",
        },
        trigger: {
            kind: "event",
            event: "payment.received",
            line: {
                vi: "M\u1ed9t kho\u1ea3ng th\u1eddi gian sau khi kh\u00e1ch thanh to\u00e1n",
                en: "A while after a customer pays",
            },
        },
        requires: {
            modules: ["sales"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "afterDays",
                kind: "number",
                min: 1,
                max: 30,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
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
        variables: ["ten_khach", "ten_shop"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, c\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 d\u00f9ng d\u1ecbch v\u1ee5 c\u1ee7a {ten_shop}. B\u1ea1n th\u1ea5y tr\u1ea3i nghi\u1ec7m th\u1ebf n\u00e0o \u1ea1? M\u1ed9t l\u1eddi nh\u1eadn x\u00e9t ng\u1eafn c\u1ee7a b\u1ea1n gi\u00fap shop r\u1ea5t nhi\u1ec1u!",
            en: "Hi {ten_khach}, thank you for choosing {ten_shop}. How was your experience? A short note helps us a lot!",
        },
        authority: {
            action: "send_care",
        },
        defaults: {
            afterDays: 1,
        },
    },
    {
        position: 14,
        key: "contract_renewal",
        version: 1,
        pack: "contracts",
        executor: "implemented",
        moduleKey: "sales",
        icon: "contract",
        name: {
            vi: "Nh\u1eafc gia h\u1ea1n h\u1ee3p \u0111\u1ed3ng",
            en: "Contract renewal notice",
        },
        description: {
            vi: "B\u00e1o kh\u00e1ch v\u00e0 b\u00e1o b\u1ea1n tr\u01b0\u1edbc khi h\u1ee3p \u0111\u1ed3ng \u0111\u1ecbnh k\u1ef3 h\u1ebft h\u1ea1n.",
            en: "Notify the customer and you before a recurring contract ends.",
        },
        trigger: {
            kind: "event",
            event: "contract.expiring",
            line: {
                vi: "M\u1ed9t s\u1ed1 ng\u00e0y tr\u01b0\u1edbc ng\u00e0y h\u1ebft h\u1ea1n h\u1ee3p \u0111\u1ed3ng",
                en: "A number of days before a contract ends",
            },
        },
        requires: {
            modules: ["sales"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_recurring_contracts"],
        },
        settings: [
            {
                key: "beforeDays",
                kind: "number",
                min: 1,
                max: 90,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Nh\u1eafc tr\u01b0\u1edbc",
                    en: "Remind before",
                },
                hint: {
                    vi: "H\u1eb1ng ng\u00e0y NIVO b\u00e1o khi c\u00f2n \u0111\u00fang s\u1ed1 ng\u00e0y n\u00e0y (ho\u1eb7c \u00edt h\u01a1n) l\u00e0 h\u1ee3p \u0111\u1ed3ng h\u1ebft h\u1ea1n.",
                    en: "Each day NIVO checks for contracts ending within this many days.",
                },
            },
            {
                key: "alwaysAsk",
                kind: "toggle",
                label: {
                    vi: "Lu\u00f4n ch\u1edd t\u00f4i duy\u1ec7t tin gia h\u1ea1n",
                    en: "Always wait for my approval",
                },
                hint: {
                    vi: "B\u1eadt: tin gia h\u1ea1n lu\u00f4n ch\u1edd b\u1ea1n duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi, k\u1ec3 c\u1ea3 khi b\u1ea1n \u0111\u00e3 cho t\u1ef1 g\u1eedi.",
                    en: "On: the renewal message always waits for you before it is sent.",
                },
            },
        ],
        contentMode: "ai_per_case",
        guardrails: [
            {
                vi: "Kh\u00f4ng h\u1ee9a k\u1ebft qu\u1ea3, kh\u00f4ng t\u1ef1 cho gi\u1ea3m gi\u00e1 hay \u01b0u \u0111\u00e3i ngo\u00e0i nh\u1eefng g\u00ec ch\u1ee7 shop \u0111\u00e3 ghi.",
                en: "No outcome promises and no discounts beyond what the owner wrote.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "ten_goi", "ngay_het_han"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, h\u1ee3p \u0111\u1ed3ng {ten_goi} c\u1ee7a b\u1ea1n v\u1edbi {ten_shop} s\u1ebd h\u1ebft h\u1ea1n v\u00e0o {ngay_het_han}. B\u1ea1n c\u00f3 mu\u1ed1n gia h\u1ea1n \u0111\u1ec3 ti\u1ebfp t\u1ee5c kh\u00f4ng \u1ea1?",
            en: "Hi {ten_khach}, your contract {ten_goi} with {ten_shop} ends on {ngay_het_han}. Would you like to renew?",
        },
        authority: {
            action: "send_follow_up",
        },
        defaults: {
            beforeDays: 14,
            alwaysAsk: true,
        },
    },
    {
        position: 3,
        key: "daily_report",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: null,
        icon: "report",
        name: {
            vi: "B\u00e1o c\u00e1o cu\u1ed1i ng\u00e0y",
            en: "End-of-day report",
        },
        description: {
            vi: "M\u1ed7i t\u1ed1i m\u1ed9t b\u1ea3n t\u00f3m t\u1eaft: kh\u00e1ch m\u1edbi, \u0111\u01a1n ch\u1ed1t, ti\u1ec1n v\u1ec1 v\u00e0 vi\u1ec7c \u0111ang ch\u1edd b\u1ea1n quy\u1ebft.",
            en: "Each evening a summary: new customers, deals won, money in and decisions waiting for you.",
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
            modules: [],
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
                key: "toOwnerChat",
                kind: "toggle",
                label: {
                    vi: "G\u1eedi th\u00eam v\u00e0o Telegram c\u1ee7a ch\u1ee7 shop",
                    en: "Also send to the owner's Telegram",
                },
                hint: {
                    vi: "Ch\u1ec9 g\u1eedi khi \u0111\u00e3 k\u1ebft n\u1ed1i Telegram.",
                    en: "Only when Telegram is connected.",
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng s\u1ed1 li\u1ec7u c\u00f3 th\u1eadt trong NIVO.",
                en: "Only real figures from NIVO.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            time: "21:00",
            toOwnerChat: true,
        },
    },
    {
        position: 6,
        key: "debt_reminder",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "accounting",
        icon: "debt",
        name: {
            vi: "Nh\u1eafc c\u00f4ng n\u1ee3",
            en: "Payment reminders",
        },
        description: {
            vi: "Kho\u1ea3n qu\u00e1 h\u1ea1n \u0111\u01b0\u1ee3c nh\u1eafc nh\u1eb9 nh\u00e0ng. L\u1ea7n nh\u1eafc th\u1ee9 hai, NIVO b\u00e1o cho b\u1ea1n bi\u1ebft.",
            en: "Overdue amounts get a polite reminder. On the second reminder NIVO tells you.",
        },
        trigger: {
            kind: "event",
            event: "invoice.overdue",
            line: {
                vi: "Khi m\u1ed9t kho\u1ea3n thanh to\u00e1n qu\u00e1 h\u1ea1n",
                en: "When a payment is overdue",
            },
        },
        requires: {
            modules: ["accounting"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_due_dates"],
        },
        settings: [
            {
                key: "afterDays",
                kind: "number",
                min: 1,
                max: 60,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Nh\u1eafc khi qu\u00e1 h\u1ea1n",
                    en: "Remind when overdue by",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "L\u1ecbch s\u1ef1, kh\u00f4ng \u0111e do\u1ea1, kh\u00f4ng nh\u1eafc t\u1edbi ph\u00ed ph\u1ea1t.",
                en: "Polite, no threats, no mention of penalties.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, {ten_shop} xin nh\u1eafc nh\u1eb9 kho\u1ea3n {so_tien} (m\u00e3 {ma_phieu}) \u0111\u00e3 \u0111\u1ebfn h\u1ea1n. N\u1ebfu b\u1ea1n \u0111\u00e3 chuy\u1ec3n r\u1ed3i, b\u1ea1n b\u1ecf qua tin n\u00e0y gi\u00fap m\u00ecnh nh\u00e9.",
            en: "Hi {ten_khach}, a gentle reminder from {ten_shop}: {so_tien} (ref {ma_phieu}) is due. If you already paid, please ignore this.",
        },
        authority: {
            action: "send_care",
        },
        defaults: {
            afterDays: 3,
        },
    },
    {
        position: 15,
        key: "delivery_notice",
        version: 1,
        pack: "delivery",
        executor: "implemented",
        moduleKey: "sales",
        icon: "truck",
        name: {
            vi: "B\u00e1o giao h\u00e0ng",
            en: "Delivery notice",
        },
        description: {
            vi: "\u0110\u01a1n v\u1eeba giao cho \u0111\u01a1n v\u1ecb v\u1eadn chuy\u1ec3n, NIVO nh\u1eafn kh\u00e1ch t\u00ean h\u00e3ng v\u00e0 m\u00e3 v\u1eadn \u0111\u01a1n \u0111\u1ec3 kh\u00e1ch theo d\u00f5i.",
            en: "When an order is handed to the carrier, NIVO tells the customer the carrier and tracking code.",
        },
        trigger: {
            kind: "event",
            event: "order.shipped",
            line: {
                vi: "Khi b\u1ea1n \u0111\u00e1nh d\u1ea5u m\u1ed9t \u0111\u01a1n \u0111\u00e3 giao cho v\u1eadn chuy\u1ec3n",
                en: "When you mark an order as handed to the carrier",
            },
        },
        requires: {
            modules: ["sales"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: ["has_delivery"],
        },
        settings: [],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "ma_phieu", "hang_van_chuyen", "ma_van_don"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, \u0111\u01a1n {ma_phieu} c\u1ee7a b\u1ea1n t\u1ea1i {ten_shop} \u0111\u00e3 \u0111\u01b0\u1ee3c giao cho {hang_van_chuyen}. M\u00e3 v\u1eadn \u0111\u01a1n: {ma_van_don}. B\u1ea1n c\u00f3 th\u1ec3 d\u00f9ng m\u00e3 n\u00e0y \u0111\u1ec3 theo d\u00f5i h\u00e0nh tr\u00ecnh nh\u00e9!",
            en: "Hi {ten_khach}, your order {ma_phieu} from {ten_shop} is with {hang_van_chuyen}. Tracking code: {ma_van_don}.",
        },
        authority: {
            action: "send_care",
        },
        defaults: {},
    },
    {
        position: 1,
        key: "thank_payment",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "accounting",
        icon: "payment",
        name: {
            vi: "C\u1ea3m \u01a1n khi nh\u1eadn ti\u1ec1n",
            en: "Thank customers when money arrives",
        },
        description: {
            vi: "Ti\u1ec1n c\u1ee7a kh\u00e1ch v\u1ec1, NIVO nh\u1eafn m\u1ed9t l\u1eddi c\u1ea3m \u01a1n tr\u00ean \u0111\u00fang k\u00eanh kh\u00e1ch \u0111ang chat.",
            en: "When a customer's money arrives, NIVO sends a thank-you on the channel they chat on.",
        },
        trigger: {
            kind: "event",
            event: "payment.received",
            line: {
                vi: "M\u1ed7i khi nh\u1eadn \u0111\u01b0\u1ee3c m\u1ed9t kho\u1ea3n thanh to\u00e1n \u0111\u00e3 \u0111\u1ed1i so\u00e1t",
                en: "Every time a payment is matched",
            },
        },
        requires: {
            modules: ["accounting"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "minAmount",
                kind: "number",
                min: 0,
                max: 1000000000,
                suffix: {
                    vi: "\u0111\u1ed3ng",
                    en: "VND",
                },
                label: {
                    vi: "Ch\u1ec9 c\u1ea3m \u01a1n t\u1eeb s\u1ed1 ti\u1ec1n",
                    en: "Only from this amount",
                },
                hint: {
                    vi: "\u0110\u1ec3 0 n\u1ebfu mu\u1ed1n c\u1ea3m \u01a1n m\u1ecdi kho\u1ea3n.",
                    en: "Leave 0 to thank every payment.",
                },
            },
        ],
        contentMode: "fixed",
        guardrails: [
            {
                vi: "Ch\u1ec9 c\u1ea3m \u01a1n v\u00e0 x\u00e1c nh\u1eadn s\u1ed1 ti\u1ec1n, kh\u00f4ng h\u1ee9a th\u00eam g\u00ec.",
                en: "Only thank and confirm the amount, promise nothing more.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "so_tien", "ma_phieu"],
        defaultBody: {
            vi: "C\u1ea3m \u01a1n {ten_khach} \u0111\u00e3 thanh to\u00e1n {so_tien}. {ten_shop} r\u1ea5t vui \u0111\u01b0\u1ee3c \u0111\u1ed3ng h\u00e0nh c\u00f9ng b\u1ea1n!",
            en: "Thank you {ten_khach} for paying {so_tien}. {ten_shop} is glad to have you!",
        },
        authority: {
            action: "send_care",
        },
        defaults: {
            minAmount: 0,
        },
    },
]
