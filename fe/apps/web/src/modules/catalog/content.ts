import type { ModuleDef } from "./catalog.types"

/** The content module. */
export const CONTENT = {
    key: "content",
    order: 90,
    name: {
        vi: "N\u1ed9i dung m\u1ea1ng x\u00e3 h\u1ed9i",
        en: "Social content",
    },
    shortName: {
        vi: "N\u1ed9i dung AI",
        en: "Content AI",
    },
    description: {
        vi: "So\u1ea1n b\u00e0i \u0111\u0103ng v\u00e0 l\u1ecbch n\u1ed9i dung theo gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u; m\u1ecdi b\u00e0i ch\u1ec9 l\u00ean m\u1ea1ng sau khi b\u1ea1n \u0111\u1ed3ng \u00fd.",
        en: "Drafts posts and a content calendar in your brand voice; nothing goes online until you approve it.",
    },
    points: {
        vi: [
            "So\u1ea1n b\u00e0i \u0111\u0103ng theo gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u",
            "G\u1ee3i \u00fd l\u1ecbch \u0111\u0103ng theo tu\u1ea7n",
            "Kh\u00f4ng bao gi\u1edd t\u1ef1 \u0111\u0103ng b\u00e0i",
        ],
        en: ["Drafts posts in your brand voice", "Suggests a weekly calendar", "Never posts by itself"],
    },
    purpose:
        "a social media assistant that drafts posts and a content calendar in the brand voice and never posts without approval",
    icon: "blog",
    glyph: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "content",
    workbench: "content",
    settingsExtras: null,
    requires: {
        capabilities: ["social_publish"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        name: "Content Agent",
        handle: "content",
        summary: {
            vi: "So\u1ea1n b\u00e0i \u0111\u0103ng v\u00e0 l\u1ecbch n\u1ed9i dung theo gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u; m\u1ecdi b\u00e0i ch\u1ec9 l\u00ean m\u1ea1ng sau khi b\u1ea1n \u0111\u1ed3ng \u00fd.",
            en: "Drafts posts and a content calendar in your brand voice; nothing goes online until you approve it.",
        },
        capabilities: {
            vi: [
                "So\u1ea1n b\u00e0i \u0111\u0103ng theo gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u",
                "G\u1ee3i \u00fd l\u1ecbch \u0111\u0103ng theo tu\u1ea7n",
                "Kh\u00f4ng bao gi\u1edd t\u1ef1 \u0111\u0103ng b\u00e0i",
            ],
            en: ["Drafts posts in your brand voice", "Suggests a weekly calendar", "Never posts by itself"],
        },
        role: {
            vi: "So\u1ea1n b\u00e0i \u0111\u0103ng m\u1ea1ng x\u00e3 h\u1ed9i \u0111\u1ec3 ch\u1ee7 duy\u1ec7t",
            en: "Drafts social posts for the owner to approve",
        },
        instructions: {
            vi: "So\u1ea1n b\u00e0i t\u1eeb th\u00f4ng tin th\u1eadt c\u1ee7a doanh nghi\u1ec7p, \u0111\u00fang gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u. Kh\u00f4ng b\u1ecba gi\u00e1, khuy\u1ebfn m\u00e3i hay s\u1ed1 li\u1ec7u. Ch\u1ec9 t\u1ea1o b\u1ea3n nh\u00e1p, kh\u00f4ng t\u1ef1 \u0111\u0103ng.",
            en: "Write posts from the business's real facts in its brand voice. Never invent prices, promotions or figures. Produce drafts only, never publish.",
        },
    },
    gates: [
        {
            key: "channels",
            label_vi: "K\u00eanh \u0111\u0103ng b\u00e0i",
            label_en: "Channels",
            hint_vi: "\u0110\u0103ng \u1edf \u0111\u00e2u: Facebook, Instagram, TikTok, Zalo OA, website.",
            hint_en: "Where you post: Facebook, Instagram, TikTok, Zalo OA, website.",
        },
        {
            key: "audience",
            label_vi: "Kh\u00e1ch h\u00e0ng m\u1ee5c ti\u00eau",
            label_en: "Target audience",
            hint_vi: "B\u00e0i vi\u1ebft cho ai, h\u1ecd quan t\u00e2m \u0111i\u1ec1u g\u00ec.",
            hint_en: "Who the posts are for and what they care about.",
        },
        {
            key: "pillars",
            label_vi: "Ch\u1ee7 \u0111\u1ec1 n\u1ed9i dung",
            label_en: "Content themes",
            hint_vi:
                "C\u00e1c nh\u00f3m n\u1ed9i dung ch\u00ednh (khuy\u1ebfn m\u00e3i, ki\u1ebfn th\u1ee9c, h\u1eadu tr\u01b0\u1eddng, ph\u1ea3n h\u1ed3i kh\u00e1ch).",
            hint_en: "Main themes: promotions, tips, behind the scenes, customer stories.",
        },
        {
            key: "cadence",
            label_vi: "T\u1ea7n su\u1ea5t \u0111\u0103ng",
            label_en: "Posting cadence",
            hint_vi: "M\u1ed7i tu\u1ea7n \u0111\u0103ng m\u1ea5y b\u00e0i, v\u00e0o ng\u00e0y gi\u1edd n\u00e0o.",
            hint_en: "How many posts a week and at what times.",
        },
        {
            key: "claims_limits",
            label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c n\u00f3i",
            label_en: "Claims to avoid",
            hint_vi:
                "Cam k\u1ebft, so s\u00e1nh, t\u1eeb ng\u1eef ho\u1eb7c ch\u1ee7 \u0111\u1ec1 kh\u00f4ng \u0111\u01b0\u1ee3c d\u00f9ng.",
            hint_en: "Promises, comparisons, wording or topics that are off limits.",
        },
        {
            key: "approval",
            label_vi: "Quy tr\u00ecnh duy\u1ec7t",
            label_en: "Approval flow",
            hint_vi: "Ai duy\u1ec7t b\u00e0i tr\u01b0\u1edbc khi \u0111\u0103ng v\u00e0 duy\u1ec7t qua \u0111\u00e2u.",
            hint_en: "Who approves a post before it goes out and where.",
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
            action: "draft_post",
            label: {
                vi: "So\u1ea1n b\u00e0i \u0111\u0103ng",
                en: "Draft a post",
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
            action: "publish_post",
            label: {
                vi: "\u0110\u0103ng b\u00e0i",
                en: "Publish a post",
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
            command: "draft_post",
            action: "draft_post",
            subjectType: "inbound",
            requiredFields: [],
            description: {
                vi: "so\u1ea1n b\u00e0i \u0111\u0103ng",
                en: "draft a post",
            },
        },
        {
            command: "publish_post",
            action: "publish_post",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
            description: {
                vi: "\u0111\u0103ng b\u00e0i",
                en: "publish the post",
            },
        },
    ],
} satisfies ModuleDef
