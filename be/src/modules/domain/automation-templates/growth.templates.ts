import type { TemplateDefinition } from "./automation-templates.contracts"

/** The growth templates the engine runs itself, in file-name order. */
export const GROWTH_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 13,
        key: "marketplace_order_sync",
        version: 1,
        pack: "marketplace",
        executor: "definition",
        moduleKey: "sales",
        icon: "cart",
        name: {
            vi: "\u0110\u1ed3ng b\u1ed9 \u0111\u01a1n t\u1eeb s\u00e0n",
            en: "Marketplace order sync",
        },
        description: {
            vi: "\u0110\u01a1n t\u1eeb Shopee, Lazada, TikTok Shop \u0111\u01b0\u1ee3c ghi v\u00e0o NIVO nh\u01b0 \u0111\u01a1n c\u1ee7a shop.",
            en: "Orders from Shopee, Lazada or TikTok Shop are recorded in NIVO like your own.",
        },
        trigger: {
            kind: "event",
            event: "order.confirmed",
            line: {
                vi: "Khi c\u00f3 \u0111\u01a1n m\u1edbi tr\u00ean s\u00e0n",
                en: "When a new marketplace order arrives",
            },
        },
        requires: {
            modules: ["sales"],
            channels: [],
            connections: ["webhook"],
            capabilities: ["sells_online"],
        },
        settings: [],
        contentMode: "none",
        guardrails: [],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {},
    },
    {
        position: 2,
        key: "nurture_leads",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "sales",
        icon: "leads",
        name: {
            vi: "Ch\u0103m kh\u00e1ch ch\u01b0a ch\u1ed1t",
            en: "Follow up undecided customers",
        },
        description: {
            vi: "Kh\u00e1ch h\u1ecfi r\u1ed3i im l\u1eb7ng \u0111\u01b0\u1ee3c nh\u1eafn h\u1ecfi l\u1ea1i, kh\u00f4ng b\u1ecf s\u00f3t ai.",
            en: "Customers who asked and went quiet get a gentle nudge, so nobody is forgotten.",
        },
        trigger: {
            kind: "event",
            event: "lead.no_reply_after",
            line: {
                vi: "Khi kh\u00e1ch ch\u01b0a ch\u1ed1t mua ho\u1eb7c t\u1eeb ch\u1ed1i sau m\u1ed9t kho\u1ea3ng th\u1eddi gian",
                en: "When a customer has neither bought nor declined after a while",
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
                key: "afterHours",
                kind: "number",
                min: 1,
                max: 720,
                suffix: {
                    vi: "gi\u1edd",
                    en: "hours",
                },
                label: {
                    vi: "Nh\u1eafn l\u1ea1i sau",
                    en: "Follow up after",
                },
            },
            {
                key: "maxFollowUps",
                kind: "number",
                min: 1,
                max: 5,
                suffix: {
                    vi: "l\u1ea7n",
                    en: "times",
                },
                label: {
                    vi: "Nh\u1eafn t\u1ed1i \u0111a",
                    en: "At most",
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
            {
                vi: "M\u1ed7i tin ng\u1eafn, nh\u1eb9 nh\u00e0ng, kh\u00f4ng th\u00fac \u00e9p.",
                en: "Short, gentle, never pushy.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "nhu_cau"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, b\u00ean {ten_shop} mu\u1ed1n h\u1ecfi b\u1ea1n \u0111\u00e3 c\u00e2n nh\u1eafc xong ch\u01b0a \u1ea1? N\u1ebfu c\u1ea7n th\u00eam th\u00f4ng tin v\u1ec1 {nhu_cau}, b\u1ea1n nh\u1eafn l\u1ea1i gi\u00fap m\u00ecnh nh\u00e9.",
            en: "Hi {ten_khach}, {ten_shop} wanted to check whether you have decided. If you need more information about {nhu_cau}, just reply.",
        },
        authority: {
            action: "send_follow_up",
        },
        defaults: {
            afterHours: 24,
            maxFollowUps: 2,
        },
    },
    {
        position: 8,
        key: "sheet_orders",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "sales",
        icon: "sheet",
        name: {
            vi: "Ghi \u0111\u01a1n v\u00e0o Google Sheet",
            en: "Record orders in Google Sheets",
        },
        description: {
            vi: "M\u1ed7i \u0111\u01a1n ch\u1ed1t t\u1ef1 th\u00eam m\u1ed9t d\u00f2ng v\u00e0o b\u1ea3ng t\u00ednh c\u1ee7a b\u1ea1n; khi kh\u00e1ch tr\u1ea3 ti\u1ec1n, d\u00f2ng \u0111\u00f3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt.",
            en: "Every confirmed order adds a row to your spreadsheet; when the customer pays, the row is updated.",
        },
        trigger: {
            kind: "event",
            event: "order.confirmed",
            line: {
                vi: "Khi c\u00f3 \u0111\u01a1n ch\u1ed1t, khi nh\u1eadn ti\u1ec1n, ho\u1eb7c khi c\u00f3 kh\u00e1ch m\u1edbi",
                en: "On a confirmed order, a payment, or a new customer",
            },
        },
        requires: {
            modules: ["sales"],
            channels: [],
            connections: ["google"],
            capabilities: [],
        },
        settings: [
            {
                key: "recordOrders",
                kind: "toggle",
                label: {
                    vi: "Ghi \u0111\u01a1n \u0111\u00e3 ch\u1ed1t",
                    en: "Record confirmed orders",
                },
            },
            {
                key: "markPaid",
                kind: "toggle",
                label: {
                    vi: "C\u1eadp nh\u1eadt khi kh\u00e1ch tr\u1ea3 ti\u1ec1n",
                    en: "Update the row when paid",
                },
            },
            {
                key: "recordLeads",
                kind: "toggle",
                label: {
                    vi: 'Ghi c\u1ea3 kh\u00e1ch m\u1edbi (trang "Kh\u00e1ch m\u1edbi")',
                    en: 'Also record new customers (tab "Kh\u00e1ch m\u1edbi")',
                },
            },
        ],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 ghi v\u00e0o b\u1ea3ng t\u00ednh c\u1ee7a ch\u1ee7 shop, kh\u00f4ng g\u1eedi g\u00ec cho kh\u00e1ch.",
                en: "Writes only to the owner's spreadsheet, sends nothing to customers.",
            },
        ],
        variables: [],
        defaultBody: null,
        authority: {
            action: null,
        },
        defaults: {
            recordOrders: true,
            markPaid: true,
            recordLeads: false,
        },
    },
    {
        position: 19,
        key: "video_new_offer",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "video",
        icon: "report",
        name: {
            vi: "So\u1ea1n video khi c\u00f3 \u01b0u \u0111\u00e3i m\u1edbi",
            en: "Draft a video when a new offer is added",
        },
        description: {
            vi: "Khi b\u1ea1n th\u00eam m\u1ed9t tri th\u1ee9c c\u00f4ng khai thu\u1ed9c ch\u1ee7 \u0111\u1ec1 \u01afu \u0111\u00e3i, NIVO so\u1ea1n s\u1eb5n k\u1ecbch b\u1ea3n video v\u00e0 b\u00e1o b\u1ea1n. Ch\u1ec9 so\u1ea1n nh\u00e1p: kh\u00f4ng d\u1ef1ng, kh\u00f4ng \u0111\u0103ng.",
            en: "When you add public knowledge under the topic \u01afu \u0111\u00e3i, NIVO drafts a video script and tells you. A draft only: nothing is rendered or published.",
        },
        trigger: {
            kind: "event",
            event: "knowledge.offer_added",
            line: {
                vi: "Khi b\u1ea1n th\u00eam tri th\u1ee9c c\u00f4ng khai thu\u1ed9c ch\u1ee7 \u0111\u1ec1 \u01afu \u0111\u00e3i (ho\u1eb7c Khuy\u1ebfn m\u00e3i)",
                en: "When you add public knowledge under the topic \u01afu \u0111\u00e3i (or Khuy\u1ebfn m\u00e3i)",
            },
        },
        requires: {
            modules: ["video"],
            channels: [],
            connections: [],
            capabilities: [],
        },
        settings: [],
        contentMode: "none",
        guardrails: [
            {
                vi: "Ch\u1ec9 d\u00f9ng \u0111\u00fang n\u1ed9i dung \u01b0u \u0111\u00e3i b\u1ea1n \u0111\u00e3 ghi; kh\u00f4ng t\u1ef1 th\u00eam gi\u00e1, th\u1eddi h\u1ea1n hay \u0111i\u1ec1u ki\u1ec7n.",
                en: "Uses only the offer you wrote; never adds prices, deadlines or conditions.",
            },
            {
                vi: "Ch\u1ec9 so\u1ea1n b\u1ea3n nh\u00e1p. D\u1ef1ng video v\u00e0 \u0111\u0103ng lu\u00f4n do b\u1ea1n b\u1ea5m.",
                en: "Drafts only. Rendering and publishing are always your click.",
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
        position: 7,
        key: "win_back",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "sales",
        icon: "winback",
        name: {
            vi: "G\u1ecdi kh\u00e1ch c\u0169 quay l\u1ea1i",
            en: "Win back past customers",
        },
        description: {
            vi: "Kh\u00e1ch l\u00e2u kh\u00f4ng gh\u00e9 \u0111\u01b0\u1ee3c so\u1ea1n s\u1eb5n m\u1ed9t l\u1eddi m\u1eddi k\u00e8m \u01b0u \u0111\u00e3i. Lu\u00f4n ch\u1edd b\u1ea1n duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi.",
            en: "Customers who have not visited in a while get a drafted invitation with an offer. It always waits for your approval.",
        },
        trigger: {
            kind: "event",
            event: "lead.no_reply_after",
            line: {
                vi: "Khi m\u1ed9t kh\u00e1ch l\u00e2u kh\u00f4ng c\u00f3 ho\u1ea1t \u0111\u1ed9ng",
                en: "When a customer has been inactive for a while",
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
                min: 7,
                max: 365,
                suffix: {
                    vi: "ng\u00e0y",
                    en: "days",
                },
                label: {
                    vi: "Kh\u00e1ch im l\u1eb7ng qu\u00e1",
                    en: "Inactive for more than",
                },
            },
            {
                key: "offer",
                kind: "text",
                maxLength: 120,
                label: {
                    vi: "\u01afu \u0111\u00e3i",
                    en: "Offer",
                },
                hint: {
                    vi: "V\u00ed d\u1ee5: gi\u1ea3m 10% cho l\u1ea7n quay l\u1ea1i.",
                    en: "For example: 10% off your next visit.",
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
                vi: "Ch\u1ec9 n\u00eau \u0111\u00fang \u01b0u \u0111\u00e3i ch\u1ee7 shop \u0111\u00e3 ghi \u1edf tr\u00ean.",
                en: "Mention only the offer the owner wrote above.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, gi\u1edd, \u0111\u1ecba ch\u1ec9 hay ch\u00ednh s\u00e1ch ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, hours, addresses or policies that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "uu_dai"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, l\u00e2u r\u1ed3i {ten_shop} ch\u01b0a g\u1eb7p b\u1ea1n! T\u1eb7ng b\u1ea1n {uu_dai}. B\u1ea1n mu\u1ed1n gh\u00e9 l\u00fac n\u00e0o \u1ea1?",
            en: "Hi {ten_khach}, we have missed you at {ten_shop}! Here is {uu_dai}. When would you like to visit?",
        },
        authority: {
            action: "send_follow_up",
            alwaysAsk: true,
        },
        defaults: {
            afterDays: 30,
            offer: "\u01b0u \u0111\u00e3i 10% cho l\u1ea7n quay l\u1ea1i",
        },
    },
]
