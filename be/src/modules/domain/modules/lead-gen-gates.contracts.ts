import type { ModuleGate } from "./modules.contracts"

/** The setup gates of the lead generation module: what it must know before it may act. */
export const LEAD_GEN_GATES: ReadonlyArray<ModuleGate> = [
    {
        key: "icp_area",
        label_vi: "Kh\u00e1ch l\u00fd t\u01b0\u1edfng v\u00e0 khu v\u1ef1c",
        label_en: "Ideal customer and area",
        hint_vi:
            "Kh\u00e1ch th\u1ebf n\u00e0o l\u00e0 ph\u00f9 h\u1ee3p, \u1edf khu v\u1ef1c n\u00e0o, \u0111\u1ed9 tu\u1ed5i ho\u1eb7c ng\u00e0nh n\u00e0o.",
        hint_en: "Who the ideal customer is, in which area, age group or industry.",
        writes: [
            {
                kind: "fact",
                subjectType: "customer",
                attributeLabel: "Kh\u00e1ch h\u00e0ng l\u00fd t\u01b0\u1edfng",
                scope: "internal",
            },
        ],
    },
    {
        key: "public_offers",
        label_vi: "\u01afu \u0111\u00e3i v\u00e0 gi\u00e1 c\u00f4ng khai",
        label_en: "Public offers and prices",
        hint_vi:
            "G\u00f3i, \u01b0u \u0111\u00e3i v\u00e0 m\u1ee9c gi\u00e1 \u0111\u01b0\u1ee3c ph\u00e9p n\u00f3i c\u00f4ng khai v\u1edbi ng\u01b0\u1eddi l\u1ea1.",
        hint_en: "Packages, offers and prices that may be told to strangers.",
        writes: [
            {
                kind: "fact",
                subjectType: "product",
                attributeLabel: "\u01afu \u0111\u00e3i v\u00e0 gi\u00e1 c\u00f4ng khai",
                scope: "public",
            },
        ],
    },
    {
        key: "qualification",
        label_vi: "C\u00e2u h\u1ecfi l\u1ecdc kh\u00e1ch",
        label_en: "Qualification questions",
        hint_vi:
            "T\u1ed1i \u0111a 4 c\u00e2u h\u1ecfi, k\u00e8m ti\u00eau ch\u00ed kh\u00e1ch n\u00f3ng, \u1ea5m, l\u1ea1nh.",
        hint_en: "At most 4 questions, with the hot, warm and cold criteria.",
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "C\u00e2u h\u1ecfi s\u00e0ng l\u1ecdc kh\u00e1ch",
                scope: "internal",
            },
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "Ti\u00eau ch\u00ed kh\u00e1ch n\u00f3ng, \u1ea5m, l\u1ea1nh",
                scope: "internal",
            },
        ],
    },
    {
        key: "objections",
        label_vi: "Ph\u1ea3n \u0111\u1ed1i th\u01b0\u1eddng g\u1eb7p v\u00e0 c\u00e1ch \u0111\u00e1p",
        label_en: "Objections and answers",
        hint_vi:
            "Kh\u00e1ch hay ch\u00ea g\u00ec (\u0111\u1eaft, xa, ch\u01b0a tin) v\u00e0 tr\u1ea3 l\u1eddi th\u1ebf n\u00e0o.",
        hint_en: "What prospects push back on (price, distance, trust) and how to answer.",
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "C\u00e1ch tr\u1ea3 l\u1eddi khi kh\u00e1ch do d\u1ef1",
                scope: "internal",
            },
        ],
    },
    {
        key: "forbidden_claims",
        label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c n\u00f3i",
        label_en: "Forbidden claims",
        hint_vi:
            "Cam k\u1ebft, so s\u00e1nh, k\u1ebft qu\u1ea3 ho\u1eb7c t\u1eeb ng\u1eef tuy\u1ec7t \u0111\u1ed1i kh\u00f4ng \u0111\u01b0\u1ee3c d\u00f9ng.",
        hint_en: "Promises, comparisons, results or wording that must never be used.",
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ee9a v\u1edbi kh\u00e1ch",
                scope: "restricted",
            },
        ],
    },
    {
        key: "hours_owner",
        label_vi: "Gi\u1edd l\u00e0m vi\u1ec7c v\u00e0 ng\u01b0\u1eddi nh\u1eadn lead",
        label_en: "Working hours and who receives leads",
        hint_vi: "Gi\u1edd ng\u01b0\u1eddi th\u1eadt tr\u1ea3 l\u1eddi v\u00e0 ai nh\u1eadn kh\u00e1ch n\u00f3ng.",
        hint_en: "When a person replies and who receives hot leads.",
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "Gi\u1edd l\u00e0m vi\u1ec7c v\u00e0 ng\u01b0\u1eddi nh\u1eadn kh\u00e1ch",
                scope: "internal",
            },
            {
                kind: "rule",
                action: "handoff_to_sales",
                field: "mode",
            },
        ],
    },
    {
        key: "tone",
        label_vi: "Gi\u1ecdng \u0111i\u1ec7u",
        label_en: "Tone",
        hint_vi:
            "C\u00e1ch x\u01b0ng h\u00f4 v\u00e0 phong c\u00e1ch khi nh\u1eafn kh\u00e1ch (d\u00f9ng chung v\u1edbi c\u00e1c agent kh\u00e1c).",
        hint_en: "How it addresses people and the style of its messages (shared with the other agents).",
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: "Gi\u1ecdng \u0111i\u1ec7u tr\u1ea3 l\u1eddi",
                scope: "restricted",
            },
        ],
    },
    {
        key: "channels_posts",
        label_vi: "K\u1ebft n\u1ed1i Page, Instagram v\u00e0 b\u00e0i c\u1ea7n theo d\u00f5i",
        label_en: "Connect Page, Instagram and posts to watch",
        hint_vi:
            "K\u1ebft n\u1ed1i Trang Facebook v\u00e0 Instagram, ch\u1ecdn b\u00e0i \u0111\u0103ng v\u00e0 qu\u1ea3ng c\u00e1o c\u1ea7n theo d\u00f5i.",
        hint_en: "Connect the Facebook Page and Instagram, then choose the posts and ads to watch.",
    },
]
