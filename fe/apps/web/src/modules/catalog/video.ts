import type { ModuleDef } from "./catalog.types"

/** The video module. */
export const VIDEO = {
    key: "video",
    order: 80,
    name: {
        vi: "T\u1ea1o video",
        en: "Video maker",
    },
    shortName: {
        vi: "Video AI",
        en: "Video AI",
    },
    description: {
        vi: "D\u1ef1ng b\u1ea3n nh\u00e1p video gi\u1edbi thi\u1ec7u t\u1eeb n\u1ed9i dung v\u00e0 h\u00ecnh \u1ea3nh c\u1ee7a b\u1ea1n; ch\u1ec9 \u0111\u0103ng khi b\u1ea1n \u0111\u00e3 xem v\u00e0 \u0111\u1ed3ng \u00fd.",
        en: "Renders draft videos from your content and photos; nothing is published until you have watched and approved it.",
    },
    points: {
        vi: [
            "D\u1ef1ng b\u1ea3n nh\u00e1p video t\u1eeb n\u1ed9i dung c\u1ee7a b\u1ea1n",
            "Gi\u1eef \u0111\u00fang gi\u1ecdng v\u00e0 h\u00ecnh \u1ea3nh th\u01b0\u01a1ng hi\u1ec7u",
            "Kh\u00f4ng bao gi\u1edd t\u1ef1 \u0111\u0103ng",
        ],
        en: ["Renders draft videos from your content", "Keeps your voice and brand look", "Never publishes by itself"],
    },
    purpose:
        "a video assistant that renders draft videos from the business's own content and photos and never publishes without the owner's approval",
    icon: "apps",
    glyph: "M4 6h12v12H4zM16 10l5-3v10l-5-3z",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "video",
    workbench: "video",
    settingsExtras: null,
    requires: {
        capabilities: ["video_render"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: {
        name: "Video Agent",
        handle: "video",
        summary: {
            vi: "D\u1ef1ng b\u1ea3n nh\u00e1p video gi\u1edbi thi\u1ec7u t\u1eeb n\u1ed9i dung v\u00e0 h\u00ecnh \u1ea3nh c\u1ee7a b\u1ea1n; ch\u1ec9 \u0111\u0103ng khi b\u1ea1n \u0111\u00e3 xem v\u00e0 \u0111\u1ed3ng \u00fd.",
            en: "Renders draft videos from your content and photos; nothing is published until you have watched and approved it.",
        },
        capabilities: {
            vi: [
                "D\u1ef1ng b\u1ea3n nh\u00e1p video t\u1eeb n\u1ed9i dung c\u1ee7a b\u1ea1n",
                "Gi\u1eef \u0111\u00fang gi\u1ecdng v\u00e0 h\u00ecnh \u1ea3nh th\u01b0\u01a1ng hi\u1ec7u",
                "Kh\u00f4ng bao gi\u1edd t\u1ef1 \u0111\u0103ng",
            ],
            en: [
                "Renders draft videos from your content",
                "Keeps your voice and brand look",
                "Never publishes by itself",
            ],
        },
        role: {
            vi: "D\u1ef1ng video nh\u00e1p \u0111\u1ec3 ch\u1ee7 duy\u1ec7t",
            en: "Renders draft videos for the owner to approve",
        },
        instructions: {
            vi: "H\u1ecfi m\u1ee5c \u0111\u00edch v\u00e0 \u0111\u1ed1i t\u01b0\u1ee3ng c\u1ee7a video, d\u00f9ng \u0111\u00fang th\u00f4ng tin v\u00e0 h\u00ecnh \u1ea3nh doanh nghi\u1ec7p \u0111\u00e3 cung c\u1ea5p. Ch\u1ec9 t\u1ea1o b\u1ea3n nh\u00e1p, kh\u00f4ng t\u1ef1 \u0111\u0103ng.",
            en: "Ask what the video is for and who watches it, use only the facts and images the business supplied. Produce drafts only, never publish.",
        },
    },
    gates: [
        {
            key: "brand_assets",
            label_vi: "H\u00ecnh \u1ea3nh v\u00e0 nh\u1eadn di\u1ec7n",
            label_en: "Brand assets",
            hint_vi:
                "Logo, m\u00e0u, ph\u00f4ng ch\u1eef, nh\u1ea1c n\u1ec1n v\u00e0 n\u01a1i l\u01b0u \u1ea3nh, video g\u1ed1c.",
            hint_en: "Logo, colours, fonts, music and where the source photos and clips live.",
        },
        {
            key: "video_goals",
            label_vi: "M\u1ee5c \u0111\u00edch v\u00e0 \u0111\u1ed1i t\u01b0\u1ee3ng",
            label_en: "Goals and audience",
            hint_vi:
                "Video d\u00f9ng \u0111\u1ec3 l\u00e0m g\u00ec (gi\u1edbi thi\u1ec7u, khuy\u1ebfn m\u00e3i, h\u01b0\u1edbng d\u1eabn) v\u00e0 cho ai xem.",
            hint_en: "What videos are for (intro, promo, how-to) and who watches.",
        },
        {
            key: "formats",
            label_vi: "\u0110\u1ecbnh d\u1ea1ng v\u00e0 th\u1eddi l\u01b0\u1ee3ng",
            label_en: "Formats and length",
            hint_vi:
                "T\u1ef7 l\u1ec7 khung h\u00ecnh, th\u1eddi l\u01b0\u1ee3ng, k\u00eanh s\u1ebd \u0111\u0103ng (TikTok, Reels, YouTube).",
            hint_en: "Aspect ratio, length and the channels they go to.",
        },
        {
            key: "claims_limits",
            label_vi: "\u0110i\u1ec1u kh\u00f4ng \u0111\u01b0\u1ee3c n\u00f3i",
            label_en: "Claims to avoid",
            hint_vi:
                "Cam k\u1ebft, so s\u00e1nh, gi\u00e1 ho\u1eb7c h\u00ecnh \u1ea3nh kh\u00f4ng \u0111\u01b0\u1ee3c xu\u1ea5t hi\u1ec7n trong video.",
            hint_en: "Promises, comparisons, prices or visuals that must never appear.",
        },
        {
            key: "approval",
            label_vi: "Quy tr\u00ecnh duy\u1ec7t",
            label_en: "Approval flow",
            hint_vi: "Ai xem v\u00e0 duy\u1ec7t b\u1ea3n nh\u00e1p tr\u01b0\u1edbc khi \u0111\u0103ng.",
            hint_en: "Who reviews and approves a draft before it goes out.",
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
            action: "render_draft",
            label: {
                vi: "D\u1ef1ng b\u1ea3n nh\u00e1p video",
                en: "Render a draft video",
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
            action: "publish_video",
            label: {
                vi: "\u0110\u0103ng video",
                en: "Publish a video",
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
            command: "render_draft",
            action: "render_draft",
            subjectType: "video_project",
            requiredFields: ["subject_id"],
            description: {
                vi: "d\u1ef1ng b\u1ea3n nh\u00e1p video",
                en: "render a video draft",
            },
        },
        {
            command: "publish_video",
            action: "publish_video",
            subjectType: "video_project",
            requiredFields: ["subject_id"],
            description: {
                vi: "\u0111\u0103ng video",
                en: "publish the video",
            },
        },
    ],
} satisfies ModuleDef
