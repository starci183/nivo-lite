import type { ModuleDefinition } from "./modules.contracts"

/** The chatbot module: its copy, agent, setup gates, authority actions and accepted commands. */
export const CHATBOT_MODULE: ModuleDefinition = {
    key: "chatbot",
    order: 10,
    name: {
        vi: "Chatbot ch\u0103m s\u00f3c kh\u00e1ch h\u00e0ng",
        en: "Customer care chatbot",
    },
    shortName: {
        vi: "Chatbot AI",
        en: "Chatbot AI",
    },
    description: {
        vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch c\u1ea3 ng\u00e0y l\u1eabn \u0111\u00eam theo nh\u1eefng g\u00ec b\u1ea1n d\u1ea1y, ghi nh\u1eadn t\u1eebng kh\u00e1ch h\u00e0ng ti\u1ec1m n\u0103ng v\u00e0 chuy\u1ec3n cho Sales.",
        en: "Answers customers day and night from what you teach it, captures every lead and hands it to Sales.",
    },
    points: {
        vi: [
            "Tr\u1ea3 l\u1eddi theo ki\u1ebfn th\u1ee9c c\u1ee7a b\u1ea1n",
            "Ghi nh\u1eadn kh\u00e1ch k\u00e8m nhu c\u1ea7u",
            "Kh\u00f4ng h\u1ee9a gi\u00e1 hay th\u1eddi h\u1ea1n",
        ],
        en: ["Answers from your knowledge", "Captures leads with their needs", "Never promises price or dates"],
    },
    purpose:
        "a customer care chatbot that answers customers from the owner's knowledge, captures leads and hands them over to Sales",
    icon: "support",
    glyph: "M4 5h16v10H9l-5 4z",
    mascot: "/images/promo/mascot-chat.png",
    category: "sales_customer",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "chatbot",
    workbench: "chatbot",
    settingsExtras: "chatbot_reply",
    requires: {
        capabilities: ["customer_chat"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    agent: {
        name: "Chatbot Agent",
        handle: "chatbot",
        summary: {
            vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch tr\u00ean website c\u1ea3 ng\u00e0y l\u1eabn \u0111\u00eam, ghi nh\u1eadn t\u1eebng kh\u00e1ch h\u00e0ng ti\u1ec1m n\u0103ng k\u00e8m nhu c\u1ea7u v\u00e0 chuy\u1ec3n cho Sales.",
            en: "Answers customers on your website day and night, captures every lead with context and hands it to Sales.",
        },
        capabilities: {
            vi: [
                "Tr\u1ea3 l\u1eddi theo ki\u1ebfn th\u1ee9c doanh nghi\u1ec7p c\u1ee7a b\u1ea1n",
                "Ghi nh\u1eadn kh\u00e1ch h\u00e0ng c\u00f9ng nhu c\u1ea7u",
                "Chuy\u1ec3n m\u1ecdi kh\u00e1ch h\u00e0ng cho Sales",
                "Kh\u00f4ng h\u1ee9a gi\u00e1 hay th\u1eddi h\u1ea1n",
            ],
            en: [
                "Answers from your business knowledge",
                "Captures leads with their needs",
                "Hands every lead to Sales",
                "Never promises price or dates",
            ],
        },
        role: {
            vi: "Ti\u1ebfp nh\u1eadn y\u00eau c\u1ea7u v\u00e0 ghi nh\u1eadn kh\u00e1ch h\u00e0ng",
            en: "Customer enquiries & lead capture",
        },
        instructions: {
            vi: "Ch\u00e0o kh\u00e1ch v\u00e0 t\u00ecm hi\u1ec3u kh\u00e1ch c\u1ea7n g\u00ec. Ch\u1ec9 tr\u1ea3 l\u1eddi d\u1ef1a tr\u00ean ki\u1ebfn th\u1ee9c doanh nghi\u1ec7p. Khi kh\u00e1ch chia s\u1ebb nhu c\u1ea7u, h\u1ecfi t\u00ean v\u00e0 c\u00f4ng ty r\u1ed3i ghi nh\u1eadn kh\u00e1ch h\u00e0ng. Kh\u00f4ng h\u1ee9a gi\u00e1, l\u1ecbch hay ph\u1ea1m vi c\u00f4ng vi\u1ec7c: n\u00f3i r\u1eb1ng m\u1ed9t th\u00e0nh vi\u00ean trong nh\u00f3m s\u1ebd x\u00e1c nh\u1eadn.",
            en: "Greet the customer and understand what they need. Answer only from the business knowledge. When the customer shares a need, ask for their name and company, then capture them as a lead. Never promise price, schedule or scope: say a team member will confirm.",
        },
    },
    gates: [
        {
            key: "identity",
            label_vi: "Th\u00f4ng tin doanh nghi\u1ec7p",
            label_en: "Business identity",
            hint_vi: "T\u00ean, b\u1ea1n l\u00e0m ngh\u1ec1 g\u00ec, ph\u1ee5c v\u1ee5 ai, \u1edf \u0111\u00e2u.",
            hint_en: "Name, what you do, who you serve, where.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: "Gi\u1edbi thi\u1ec7u",
                    scope: "public",
                },
            ],
        },
        {
            key: "products",
            label_vi: "S\u1ea3n ph\u1ea9m v\u00e0 gi\u00e1",
            label_en: "Products and prices",
            hint_vi:
                "D\u1ecbch v\u1ee5/s\u1ea3n ph\u1ea9m ch\u00ednh v\u00e0 m\u1ee9c gi\u00e1 ho\u1eb7c c\u00e1ch b\u00e1o gi\u00e1.",
            hint_en: "Main products or services and their prices or how you quote.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "product",
                    attributeLabel: "Gi\u00e1",
                    scope: "public",
                },
            ],
        },
        {
            key: "support_scope",
            label_vi: "Ph\u1ea1m vi h\u1ed7 tr\u1ee3",
            label_en: "Support scope",
            hint_vi:
                "Chatbot \u0111\u01b0\u1ee3c tr\u1ea3 l\u1eddi nh\u1eefng g\u00ec v\u00e0 kh\u00f4ng tr\u1ea3 l\u1eddi nh\u1eefng g\u00ec.",
            hint_en: "What the chatbot may answer and what it must leave alone.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Ph\u1ea1m vi tr\u1ea3 l\u1eddi c\u1ee7a chatbot",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "channels",
            label_vi: "K\u00eanh ti\u1ebfp nh\u1eadn",
            label_en: "Channels",
            hint_vi: "Kh\u00e1ch nh\u1eafn qua \u0111\u00e2u: website, Telegram, Zalo, Facebook...",
            hint_en: "Where customers write: website, Telegram, Zalo, Facebook...",
        },
        {
            key: "hours_sla",
            label_vi: "Gi\u1edd l\u00e0m vi\u1ec7c v\u00e0 th\u1eddi gian ph\u1ea3n h\u1ed3i",
            label_en: "Hours and response time",
            hint_vi:
                "Gi\u1edd l\u00e0m vi\u1ec7c v\u00e0 bao l\u00e2u th\u00ec ng\u01b0\u1eddi th\u1eadt tr\u1ea3 l\u1eddi.",
            hint_en: "Opening hours and how fast a person follows up.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: "Gi\u1edd l\u00e0m vi\u1ec7c",
                    scope: "public",
                },
                {
                    kind: "fact",
                    subjectType: "business",
                    attributeLabel: "Th\u1eddi gian ph\u1ea3n h\u1ed3i c\u1ee7a nh\u00e2n vi\u00ean",
                    scope: "internal",
                },
            ],
        },
        {
            key: "handoff",
            label_vi: "Khi n\u00e0o chuy\u1ec3n cho ng\u01b0\u1eddi",
            label_en: "Handoff rules",
            hint_vi:
                "T\u00ecnh hu\u1ed1ng n\u00e0o bot ph\u1ea3i chuy\u1ec3n cho nh\u00e2n vi\u00ean v\u00e0 chuy\u1ec3n cho ai.",
            hint_en: "When the bot must hand over to a person, and to whom.",
            writes: [
                {
                    kind: "rule",
                    action: "handoff_lead",
                    field: "mode",
                },
            ],
        },
        {
            key: "prohibited",
            label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ee9a",
            label_en: "Prohibited commitments",
            hint_vi:
                "Gi\u00e1, l\u1ecbch, b\u1ea3o h\u00e0nh, ho\u00e0n ti\u1ec1n... bot kh\u00f4ng \u0111\u01b0\u1ee3c t\u1ef1 cam k\u1ebft.",
            hint_en: "Price, schedule, warranty, refunds... the bot must never promise.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "\u0110i\u1ec1u chatbot kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ee9a",
                    scope: "restricted",
                },
            ],
        },
        {
            key: "tone",
            label_vi: "Gi\u1ecdng \u0111i\u1ec7u",
            label_en: "Tone",
            hint_vi: "C\u00e1ch x\u01b0ng h\u00f4 v\u00e0 phong c\u00e1ch tr\u1ea3 l\u1eddi.",
            hint_en: "How it addresses people and the style of its answers.",
            writes: [
                {
                    kind: "fact",
                    subjectType: "policy",
                    attributeLabel: "Gi\u1ecdng \u0111i\u1ec7u tr\u1ea3 l\u1eddi",
                    scope: "restricted",
                },
            ],
        },
    ],
    authorityActions: [
        {
            action: "reply_customer",
            label: {
                vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch",
                en: "Reply to customer",
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
            action: "handoff_lead",
            label: {
                vi: "Chuy\u1ec3n lead",
                en: "Hand off lead",
            },
            mode: "auto",
            limitVnd: null,
            requiredFields: ["contact_name", "need"],
            amountLimit: false,
            maxMode: null,
            note: "",
            next: ["classify_lead"],
        },
    ],
    accepts: [
        {
            command: "reply_customer",
            action: "reply_customer",
            subjectType: "conversation",
            requiredFields: ["subject_id"],
            description: {
                vi: "tr\u1ea3 l\u1eddi kh\u00e1ch",
                en: "reply to the customer",
            },
        },
        {
            command: "handoff_lead",
            action: "handoff_lead",
            subjectType: "conversation",
            requiredFields: ["subject_id"],
            description: {
                vi: "ti\u1ebfp nh\u1eadn kh\u00e1ch m\u1edbi",
                en: "take in the new lead",
            },
        },
    ],
}
