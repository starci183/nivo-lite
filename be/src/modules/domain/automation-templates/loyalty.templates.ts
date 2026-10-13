import type { TemplateDefinition } from "./automation-templates.contracts"

/** The loyalty templates the engine runs itself, in file-name order. */
export const LOYALTY_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
    {
        position: 20,
        key: "loyalty_birthday",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "loyalty",
        icon: "calendar",
        name: {
            vi: "Ch\u00fac m\u1eebng sinh nh\u1eadt k\u00e8m qu\u00e0",
            en: "Birthday greeting with a gift",
        },
        description: {
            vi: '\u0110\u00fang ng\u00e0y sinh nh\u1eadt, kh\u00e1ch th\u00e2n thi\u1ebft nh\u1eadn \u0111i\u1ec3m th\u01b0\u1edfng v\u00e0 l\u1eddi ch\u00fac. Tin nh\u1eafn \u0111i theo quy\u1ec1n "G\u1eedi khuy\u1ebfn m\u00e3i" c\u1ee7a b\u1ea1n.',
            en: 'On their birthday a loyalty member gets bonus points and a greeting. The message follows your "Send a promotion" rule.',
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y, trong gi\u1edd \u0111\u01b0\u1ee3c ph\u00e9p g\u1eedi, cho kh\u00e1ch c\u00f3 sinh nh\u1eadt h\u00f4m \u0111\u00f3",
                en: "Every day, within the sending hours, for members whose birthday is today",
            },
        },
        requires: {
            modules: ["loyalty"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [],
        contentMode: "ai_per_case",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00eau \u0111\u00fang qu\u00e0, \u0111i\u1ec3m v\u00e0 quy\u1ec1n l\u1ee3i \u0111\u00e3 ghi trong ch\u01b0\u01a1ng tr\u00ecnh c\u1ee7a c\u1eeda h\u00e0ng.",
                en: "Mention only the gifts, points and benefits written in the shop's programme.",
            },
            {
                vi: "Kh\u00f4ng h\u1ee9a qu\u00e0, gi\u1ea3m gi\u00e1 hay h\u1ea1ng th\u00e0nh vi\u00ean ngo\u00e0i danh m\u1ee5c.",
                en: "Never promise gifts, discounts or tiers outside the catalogue.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, ng\u00e0y, \u0111\u1ecba ch\u1ec9 hay \u0111i\u1ec1u ki\u1ec7n ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, dates, addresses or conditions that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "uu_dai"],
        defaultBody: {
            vi: "Ch\u00fac m\u1eebng sinh nh\u1eadt {ten_khach}! {ten_shop} t\u1eb7ng b\u1ea1n {uu_dai}. Ch\u00fac b\u1ea1n m\u1ed9t ng\u00e0y th\u1eadt vui, h\u1eb9n g\u1eb7p l\u1ea1i b\u1ea1n nh\u00e9!",
            en: "Happy birthday {ten_khach}! {ten_shop} gives you {uu_dai}.",
        },
        authority: {
            action: "send_promo",
        },
        defaults: {},
    },
    {
        position: 22,
        key: "loyalty_expiring",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "loyalty",
        icon: "moon",
        name: {
            vi: "B\u00e1o \u0111i\u1ec3m s\u1eafp h\u1ebft h\u1ea1n",
            en: "Warn about expiring points",
        },
        description: {
            vi: "Nh\u1eafc kh\u00e1ch c\u00f3 \u0111i\u1ec3m s\u1eafp h\u1ebft h\u1ea1n \u0111\u1ec3 h\u1ecd k\u1ecbp \u0111\u1ed5i qu\u00e0. M\u1ed7i \u0111\u1ee3t h\u1ebft h\u1ea1n ch\u1ec9 b\u00e1o m\u1ed9t l\u1ea7n.",
            en: "Reminds members whose points are about to expire so they can redeem in time. Once per expiry batch.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "M\u1ed7i ng\u00e0y, cho kh\u00e1ch c\u00f3 \u0111i\u1ec3m h\u1ebft h\u1ea1n trong s\u1ed1 ng\u00e0y c\u1ea3nh b\u00e1o c\u1ee7a ch\u01b0\u01a1ng tr\u00ecnh",
                en: "Every day, for members with points expiring within the programme's warning days",
            },
        },
        requires: {
            modules: ["loyalty"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [],
        contentMode: "ai_per_case",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00eau \u0111\u00fang qu\u00e0, \u0111i\u1ec3m v\u00e0 quy\u1ec1n l\u1ee3i \u0111\u00e3 ghi trong ch\u01b0\u01a1ng tr\u00ecnh c\u1ee7a c\u1eeda h\u00e0ng.",
                en: "Mention only the gifts, points and benefits written in the shop's programme.",
            },
            {
                vi: "Kh\u00f4ng h\u1ee9a qu\u00e0, gi\u1ea3m gi\u00e1 hay h\u1ea1ng th\u00e0nh vi\u00ean ngo\u00e0i danh m\u1ee5c.",
                en: "Never promise gifts, discounts or tiers outside the catalogue.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, ng\u00e0y, \u0111\u1ecba ch\u1ec9 hay \u0111i\u1ec1u ki\u1ec7n ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, dates, addresses or conditions that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "diem", "han"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, b\u1ea1n c\u00f3 {diem} \u0111i\u1ec3m s\u1eafp h\u1ebft h\u1ea1n v\u00e0o {han}. Gh\u00e9 {ten_shop} \u0111\u1ed5i qu\u00e0 tr\u01b0\u1edbc ng\u00e0y \u0111\u00f3 nh\u00e9!",
            en: "Hi {ten_khach}, {diem} of your points expire on {han}.",
        },
        authority: {
            action: "send_promo",
        },
        defaults: {},
    },
    {
        position: 21,
        key: "loyalty_tier_up",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "loyalty",
        icon: "review",
        name: {
            vi: "Ch\u00fac m\u1eebng l\u00ean h\u1ea1ng",
            en: "Congratulate a tier upgrade",
        },
        description: {
            vi: "Khi m\u1ed9t l\u1ea7n mua \u0111\u01b0a kh\u00e1ch l\u00ean h\u1ea1ng cao h\u01a1n, b\u00e1o cho kh\u00e1ch bi\u1ebft h\u1ea1ng m\u1edbi v\u00e0 quy\u1ec1n l\u1ee3i.",
            en: "When a purchase lifts a member to a higher tier, tell them the new tier and its benefits.",
        },
        trigger: {
            kind: "event",
            event: "loyalty.tier_up",
            line: {
                vi: "Khi kh\u00e1ch l\u00ean h\u1ea1ng th\u00e0nh vi\u00ean m\u1edbi",
                en: "When a member reaches a new tier",
            },
        },
        requires: {
            modules: ["loyalty"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [],
        contentMode: "ai_per_case",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00eau \u0111\u00fang qu\u00e0, \u0111i\u1ec3m v\u00e0 quy\u1ec1n l\u1ee3i \u0111\u00e3 ghi trong ch\u01b0\u01a1ng tr\u00ecnh c\u1ee7a c\u1eeda h\u00e0ng.",
                en: "Mention only the gifts, points and benefits written in the shop's programme.",
            },
            {
                vi: "Kh\u00f4ng h\u1ee9a qu\u00e0, gi\u1ea3m gi\u00e1 hay h\u1ea1ng th\u00e0nh vi\u00ean ngo\u00e0i danh m\u1ee5c.",
                en: "Never promise gifts, discounts or tiers outside the catalogue.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, ng\u00e0y, \u0111\u1ecba ch\u1ec9 hay \u0111i\u1ec1u ki\u1ec7n ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, dates, addresses or conditions that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "hang", "uu_dai"],
        defaultBody: {
            vi: "Ch\u00fac m\u1eebng {ten_khach}! B\u1ea1n v\u1eeba l\u00ean h\u1ea1ng {hang} t\u1ea1i {ten_shop}. {uu_dai} C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 lu\u00f4n \u0111\u1ed3ng h\u00e0nh.",
            en: "Congratulations {ten_khach}! You reached {hang} at {ten_shop}. {uu_dai}",
        },
        authority: {
            action: "send_promo",
        },
        defaults: {},
    },
    {
        position: 23,
        key: "loyalty_winback",
        version: 1,
        pack: "core",
        executor: "implemented",
        moduleKey: "loyalty",
        icon: "winback",
        name: {
            vi: "M\u1eddi kh\u00e1ch th\u00e2n thi\u1ebft l\u00e2u kh\u00f4ng quay l\u1ea1i",
            en: "Invite lapsed loyalty members back",
        },
        description: {
            vi: "Kh\u00e1ch l\u00e2u kh\u00f4ng mua \u0111\u01b0\u1ee3c m\u1eddi quay l\u1ea1i, s\u1ed1 ng\u00e0y t\u00ednh theo h\u1ea1ng c\u1ee7a h\u1ecd (h\u1ea1ng cao \u0111\u01b0\u1ee3c m\u1eddi s\u1edbm h\u01a1n). Lu\u00f4n ch\u1edd b\u1ea1n duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi.",
            en: "Members who have not bought for a while are invited back; the number of days follows their tier (higher tiers sooner). It always waits for your approval.",
        },
        trigger: {
            kind: "schedule",
            event: "schedule.daily",
            line: {
                vi: "Khi kh\u00e1ch ch\u01b0a mua l\u1ea1i qu\u00e1 s\u1ed1 ng\u00e0y c\u1ee7a h\u1ea1ng h\u1ecd",
                en: "When a member has not bought for longer than their tier's number of days",
            },
        },
        requires: {
            modules: ["loyalty"],
            channels: ["customer_chat"],
            connections: [],
            capabilities: [],
        },
        settings: [
            {
                key: "offer",
                kind: "text",
                maxLength: 120,
                label: {
                    vi: "\u01afu \u0111\u00e3i",
                    en: "Offer",
                },
                hint: {
                    vi: "V\u00ed d\u1ee5: t\u1eb7ng th\u00eam 50 \u0111i\u1ec3m cho \u0111\u01a1n k\u1ebf ti\u1ebfp.",
                    en: "For example: 50 bonus points on the next order.",
                },
            },
        ],
        contentMode: "ai_per_case",
        guardrails: [
            {
                vi: "Ch\u1ec9 n\u00eau \u0111\u00fang qu\u00e0, \u0111i\u1ec3m v\u00e0 quy\u1ec1n l\u1ee3i \u0111\u00e3 ghi trong ch\u01b0\u01a1ng tr\u00ecnh c\u1ee7a c\u1eeda h\u00e0ng.",
                en: "Mention only the gifts, points and benefits written in the shop's programme.",
            },
            {
                vi: "Kh\u00f4ng h\u1ee9a qu\u00e0, gi\u1ea3m gi\u00e1 hay h\u1ea1ng th\u00e0nh vi\u00ean ngo\u00e0i danh m\u1ee5c.",
                en: "Never promise gifts, discounts or tiers outside the catalogue.",
            },
            {
                vi: "Kh\u00f4ng b\u1ecba gi\u00e1, ng\u00e0y, \u0111\u1ecba ch\u1ec9 hay \u0111i\u1ec1u ki\u1ec7n ch\u01b0a c\u00f3 trong th\u00f4ng tin c\u1eeda h\u00e0ng.",
                en: "Never invent prices, dates, addresses or conditions that are not in the shop information.",
            },
        ],
        variables: ["ten_khach", "ten_shop", "diem", "hang", "uu_dai"],
        defaultBody: {
            vi: "Ch\u00e0o {ten_khach}, l\u00e2u r\u1ed3i {ten_shop} ch\u01b0a g\u1eb7p b\u1ea1n. B\u1ea1n c\u00f2n {diem} \u0111i\u1ec3m \u1edf h\u1ea1ng {hang}, {uu_dai} H\u1eb9n g\u1eb7p l\u1ea1i b\u1ea1n!",
            en: "Hi {ten_khach}, we miss you at {ten_shop}. You still have {diem} points at {hang}. {uu_dai}",
        },
        authority: {
            action: "send_promo",
            alwaysAsk: true,
        },
        defaults: {
            offer: "t\u1eb7ng th\u00eam \u0111i\u1ec3m cho \u0111\u01a1n k\u1ebf ti\u1ebfp",
        },
    },
]
