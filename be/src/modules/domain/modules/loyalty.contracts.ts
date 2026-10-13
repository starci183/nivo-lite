import type { ModuleDefinition } from "./modules.contracts"

/** The loyalty module: its copy, agent, setup gates, authority actions and accepted commands. */
export const LOYALTY_MODULE: ModuleDefinition = {
    key: "loyalty",
    order: 70,
    name: {
        vi: "Kh\u00e1ch h\u00e0ng th\u00e2n thi\u1ebft",
        en: "Customer loyalty",
    },
    shortName: {
        vi: "Th\u00e2n thi\u1ebft AI",
        en: "Loyalty AI",
    },
    description: {
        vi: "C\u1ed9ng \u0111i\u1ec3m cho kh\u00e1ch quen, \u0111\u1ed5i qu\u00e0 trong h\u1ea1n m\u1ee9c b\u1ea1n \u0111\u1eb7t v\u00e0 so\u1ea1n \u01b0u \u0111\u00e3i; g\u1eedi khuy\u1ebfn m\u00e3i h\u00e0ng lo\u1ea1t lu\u00f4n do b\u1ea1n duy\u1ec7t.",
        en: "Awards points to regulars, redeems rewards within the limit you set and drafts offers; bulk promotions always wait for your approval.",
    },
    points: {
        vi: [
            "C\u1ed9ng \u0111i\u1ec3m t\u1ef1 \u0111\u1ed9ng sau m\u1ed7i l\u1ea7n mua",
            "\u0110\u1ed5i qu\u00e0 trong h\u1ea1n m\u1ee9c b\u1ea1n \u0111\u1eb7t",
            "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi khuy\u1ebfn m\u00e3i hay ch\u1ec9nh \u0111i\u1ec3m",
        ],
        en: [
            "Awards points after each purchase",
            "Redeems rewards within your limit",
            "Asks you before sending promotions or adjusting points",
        ],
    },
    purpose:
        "a customer loyalty assistant that awards points, redeems rewards within the owner's limit and drafts promotions for approval",
    icon: "reward",
    glyph: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    mascot: "/images/promo/mascot-offer.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "loyalty",
    workbench: "loyalty",
    settingsExtras: "loyalty_program",
    requires: {
        capabilities: ["customer_messaging"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        name: "Loyalty Agent",
        handle: "loyalty",
        summary: {
            vi: "C\u1ed9ng \u0111i\u1ec3m cho kh\u00e1ch quen, \u0111\u1ed5i qu\u00e0 trong h\u1ea1n m\u1ee9c b\u1ea1n \u0111\u1eb7t v\u00e0 so\u1ea1n \u01b0u \u0111\u00e3i; g\u1eedi khuy\u1ebfn m\u00e3i h\u00e0ng lo\u1ea1t lu\u00f4n do b\u1ea1n duy\u1ec7t.",
            en: "Awards points to regulars, redeems rewards within the limit you set and drafts offers; bulk promotions always wait for your approval.",
        },
        capabilities: {
            vi: [
                "C\u1ed9ng \u0111i\u1ec3m t\u1ef1 \u0111\u1ed9ng sau m\u1ed7i l\u1ea7n mua",
                "\u0110\u1ed5i qu\u00e0 trong h\u1ea1n m\u1ee9c b\u1ea1n \u0111\u1eb7t",
                "H\u1ecfi b\u1ea1n tr\u01b0\u1edbc khi g\u1eedi khuy\u1ebfn m\u00e3i",
            ],
            en: [
                "Awards points after each purchase",
                "Redeems rewards within your limit",
                "Asks you before sending promotions",
            ],
        },
        role: {
            vi: "Ch\u0103m s\u00f3c kh\u00e1ch quen b\u1eb1ng \u0111i\u1ec3m v\u00e0 \u01b0u \u0111\u00e3i",
            en: "Looks after regulars with points and offers",
        },
        instructions: {
            vi: "Ghi \u0111i\u1ec3m theo quy t\u1eafc \u0111\u00e3 duy\u1ec7t, tr\u1ea3 l\u1eddi kh\u00e1ch v\u1ec1 \u0111i\u1ec3m v\u00e0 qu\u00e0. Kh\u00f4ng t\u1ef1 t\u1ea1o \u01b0u \u0111\u00e3i m\u1edbi hay h\u1ee9a qu\u00e0 ngo\u00e0i danh m\u1ee5c.",
            en: "Record points by the approved rules and answer customers about points and rewards. Never invent new offers or promise rewards outside the catalogue.",
        },
    },
    gates: [
        {
            key: "earn_rules",
            label_vi: "C\u00e1ch t\u00edch \u0111i\u1ec3m",
            label_en: "How points are earned",
            hint_vi:
                "Mua bao nhi\u00eau \u0111\u01b0\u1ee3c bao nhi\u00eau \u0111i\u1ec3m, h\u00e0nh \u0111\u1ed9ng n\u00e0o kh\u00e1c \u0111\u01b0\u1ee3c \u0111i\u1ec3m.",
            hint_en: "How much spend earns how many points and what else earns points.",
        },
        {
            key: "tiers",
            label_vi: "H\u1ea1ng th\u00e0nh vi\u00ean",
            label_en: "Membership tiers",
            hint_vi:
                "C\u00f3 h\u1ea1ng n\u00e0o (v\u00ed d\u1ee5 \u0110\u1ed3ng, B\u1ea1c, V\u00e0ng), chi ti\u00eau bao nhi\u00eau th\u00ec l\u00ean h\u1ea1ng, m\u1ed7i h\u1ea1ng \u0111\u01b0\u1ee3c quy\u1ec1n l\u1ee3i g\u00ec.",
            hint_en:
                "Which tiers exist (for example Bronze, Silver, Gold), the spend that reaches each and its benefits.",
        },
        {
            key: "rewards",
            label_vi: "Danh m\u1ee5c qu\u00e0",
            label_en: "Reward catalogue",
            hint_vi:
                "\u0110\u1ed5i \u0111\u01b0\u1ee3c nh\u1eefng g\u00ec, m\u1ed7i m\u00f3n c\u1ea7n bao nhi\u00eau \u0111i\u1ec3m v\u00e0 gi\u00e1 tr\u1ecb quy \u0111\u1ed5i.",
            hint_en: "What can be redeemed, the points each needs and its cash value.",
        },
        {
            key: "limits",
            label_vi: "H\u1ea1n m\u1ee9c t\u1ef1 \u0111\u1ed5i qu\u00e0",
            label_en: "Redeem limit",
            hint_vi:
                "Gi\u00e1 tr\u1ecb qu\u00e0 t\u1ed1i \u0111a tr\u1ee3 l\u00fd \u0111\u01b0\u1ee3c t\u1ef1 \u0111\u1ed5i, tr\u00ean m\u1ee9c \u0111\u00f3 th\u00ec h\u1ecfi b\u1ea1n.",
            hint_en: "The reward value the assistant may redeem alone before asking you.",
        },
        {
            key: "expiry",
            label_vi: "H\u1ea1n d\u00f9ng \u0111i\u1ec3m",
            label_en: "Points expiry",
            hint_vi:
                "\u0110i\u1ec3m c\u00f3 h\u1ebft h\u1ea1n kh\u00f4ng, khi n\u00e0o, b\u00e1o kh\u00e1ch th\u1ebf n\u00e0o.",
            hint_en: "Whether and when points expire and how customers are told.",
        },
        {
            key: "birthday",
            label_vi: "Qu\u00e0 sinh nh\u1eadt",
            label_en: "Birthday gift",
            hint_vi:
                "C\u00f3 t\u1eb7ng qu\u00e0 hay \u0111i\u1ec3m v\u00e0o sinh nh\u1eadt kh\u00e1ch kh\u00f4ng, t\u1eb7ng g\u00ec.",
            hint_en: "Whether members get a gift or points on their birthday and what it is.",
        },
        {
            key: "promo_rules",
            label_vi: "Quy t\u1eafc g\u1eedi khuy\u1ebfn m\u00e3i",
            label_en: "Promotion rules",
            hint_vi:
                "Ai \u0111\u01b0\u1ee3c nh\u1eadn, g\u1eedi t\u1ed1i \u0111a bao nhi\u00eau tin m\u1ed7i th\u00e1ng, gi\u1edd \u0111\u01b0\u1ee3c g\u1eedi.",
            hint_en: "Who receives them, the monthly cap and allowed send hours.",
        },
        {
            key: "prohibited",
            label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ee9a",
            label_en: "Prohibited commitments",
            hint_vi:
                "Qu\u00e0, gi\u1ea3m gi\u00e1, h\u1ea1ng th\u00e0nh vi\u00ean bot kh\u00f4ng \u0111\u01b0\u1ee3c t\u1ef1 cam k\u1ebft.",
            hint_en: "Gifts, discounts or tiers the assistant must never promise.",
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
            action: "award_points",
            label: {
                vi: "C\u1ed9ng \u0111i\u1ec3m",
                en: "Award points",
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
            action: "redeem_reward",
            label: {
                vi: "\u0110\u1ed5i qu\u00e0",
                en: "Redeem a reward",
            },
            mode: "auto",
            limitVnd: 500000,
            requiredFields: [],
            amountLimit: true,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "send_promo",
            label: {
                vi: "G\u1eedi khuy\u1ebfn m\u00e3i",
                en: "Send a promotion",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: ["contact"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: [],
        },
        {
            action: "adjust_points",
            label: {
                vi: "\u0110i\u1ec1u ch\u1ec9nh \u0111i\u1ec3m th\u1ee7 c\u00f4ng",
                en: "Adjust points by hand",
            },
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: "ask",
            note: "",
            next: [],
        },
    ],
    accepts: [
        {
            command: "award_points",
            action: "award_points",
            subjectType: "lead",
            requiredFields: [],
            description: {
                vi: "c\u1ed9ng \u0111i\u1ec3m",
                en: "award points",
            },
        },
        {
            command: "redeem_reward",
            action: "redeem_reward",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "\u0111\u1ed5i qu\u00e0",
                en: "redeem a reward",
            },
        },
        {
            command: "send_promo",
            action: "send_promo",
            subjectType: "lead",
            requiredFields: [],
            description: {
                vi: "g\u1eedi khuy\u1ebfn m\u00e3i",
                en: "send the promotion",
            },
        },
        {
            command: "adjust_points",
            action: "adjust_points",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: {
                vi: "\u0111i\u1ec1u ch\u1ec9nh \u0111i\u1ec3m",
                en: "adjust points",
            },
        },
    ],
}
