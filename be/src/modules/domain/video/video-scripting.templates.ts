/** The Vietnamese text used by a script goal. */
interface ScriptGoalText {
    /** Product copy. */
    readonly vi: string
}

/** One step in a marketing goal's outline. */
interface ScriptTemplateScene {
    /** Story role. */
    readonly role: string
    /** Scene instruction. */
    readonly brief: string
}

/** The goal copy and its outline. */
interface ScriptGoalTemplate {
    /** Goal label. */
    readonly label: ScriptGoalText
    /** Goal guidance. */
    readonly hint: ScriptGoalText
    /** Ordered story structure. */
    readonly scenes: ReadonlyArray<ScriptTemplateScene>
}

/** Goals include a guaranteed fallback for legacy or unknown keys. */
interface ScriptGoalTemplates extends Readonly<Record<string, ScriptGoalTemplate>> {
    /** Fallback custom goal. */
    readonly custom: ScriptGoalTemplate
}

/** Existing marketing goal briefs, now owned by the backend. */
export const VIDEO_SCRIPT_GOALS: ScriptGoalTemplates = {
    testimonial: {
        label: {
            vi: "Ph\u1ea3n h\u1ed3i kh\u00e1ch",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng m\u1ed9t c\u00e2u kh\u00e1ch th\u1eadt \u0111\u00e3 n\u00f3i (tr\u00edch \u0111\u00fang, kh\u00f4ng th\u00eam b\u1edbt).",
            },
            {
                role: "body",
                brief: "Kh\u00e1ch g\u1eb7p v\u1ea5n \u0111\u1ec1 g\u00ec tr\u01b0\u1edbc \u0111\u00f3, h\u1ecd \u0111\u00e3 ch\u1ecdn b\u1ea1n v\u00ec l\u00fd do n\u00e0o.",
            },
            {
                role: "body",
                brief: "K\u1ebft qu\u1ea3 kh\u00e1ch c\u1ea3m nh\u1eadn, d\u00f9ng \u0111\u00fang l\u1eddi kh\u00e1ch; kh\u00f4ng h\u1ee9a ch\u1eafc k\u1ebft qu\u1ea3 cho ng\u01b0\u1eddi kh\u00e1c.",
            },
            {
                role: "cta",
                brief: "M\u1eddi kh\u00e1ch m\u1edbi li\u00ean h\u1ec7 \u0111\u1ec3 \u0111\u01b0\u1ee3c t\u01b0 v\u1ea5n.",
            },
        ],
        hint: {
            vi: "K\u1ec3 l\u1ea1i l\u1eddi kh\u00e1ch th\u1eadt n\u00f3i v\u1ec1 b\u1ea1n. Ch\u1ec9 d\u00f9ng ph\u1ea3n h\u1ed3i th\u1eadt.",
        },
    },
    offer: {
        label: {
            vi: "\u01afu \u0111\u00e3i",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng \u01b0u \u0111\u00e3i n\u1ed5i b\u1eadt nh\u1ea5t, ng\u1eafn g\u1ecdn, \u0111\u00fang con s\u1ed1 \u0111\u00e3 ghi.",
            },
            {
                role: "body",
                brief: "\u01afu \u0111\u00e3i \u00e1p d\u1ee5ng cho g\u00ec, cho ai, \u0111i\u1ec1u ki\u1ec7n k\u00e8m theo.",
            },
            {
                role: "body",
                brief: "Th\u1eddi h\u1ea1n ho\u1eb7c s\u1ed1 l\u01b0\u1ee3ng c\u00f3 h\u1ea1n n\u1ebfu th\u00f4ng tin c\u00f3 ghi; kh\u00f4ng t\u1ef1 th\u00eam khan hi\u1ebfm gi\u1ea3.",
            },
            {
                role: "cta",
                brief: "K\u00eau g\u1ecdi h\u00e0nh \u0111\u1ed9ng r\u00f5 r\u00e0ng: nh\u1eafn tin, g\u1ecdi, ho\u1eb7c \u0111\u1eb7t l\u1ecbch tr\u01b0\u1edbc h\u1ea1n.",
            },
        ],
        hint: {
            vi: "B\u00e1o \u01b0u \u0111\u00e3i \u0111ang c\u00f3, \u0111\u00fang th\u1eddi h\u1ea1n v\u00e0 \u0111i\u1ec1u ki\u1ec7n b\u1ea1n \u0111\u00e3 ghi.",
        },
    },
    behind_scenes: {
        label: {
            vi: "H\u1eadu tr\u01b0\u1eddng",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng m\u1ed9t kho\u1ea3nh kh\u1eafc \u0111\u1eddi th\u01b0\u1eddng trong c\u00f4ng vi\u1ec7c, g\u1ee3i t\u00f2 m\u00f2.",
            },
            {
                role: "body",
                brief: "Cho th\u1ea5y m\u1ed9t b\u01b0\u1edbc trong c\u00e1ch l\u00e0m vi\u1ec7c ho\u1eb7c chu\u1ea9n b\u1ecb.",
            },
            {
                role: "body",
                brief: "Gi\u1edbi thi\u1ec7u con ng\u01b0\u1eddi ho\u1eb7c gi\u00e1 tr\u1ecb \u0111\u1ed9i ng\u0169 coi tr\u1ecdng, d\u00f9ng th\u00f4ng tin c\u00f3 th\u1eadt.",
            },
            {
                role: "cta",
                brief: "M\u1eddi kh\u00e1ch gh\u00e9 th\u0103m ho\u1eb7c theo d\u00f5i \u0111\u1ec3 xem th\u00eam.",
            },
        ],
        hint: {
            vi: "Cho kh\u00e1ch th\u1ea5y con ng\u01b0\u1eddi v\u00e0 c\u00e1ch l\u00e0m vi\u1ec7c ph\u00eda sau.",
        },
    },
    service: {
        label: {
            vi: "Gi\u1edbi thi\u1ec7u d\u1ecbch v\u1ee5",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng m\u1ed9t c\u00e2u h\u1ecfi ho\u1eb7c v\u1ea5n \u0111\u1ec1 kh\u00e1ch th\u01b0\u1eddng g\u1eb7p m\u00e0 d\u1ecbch v\u1ee5 n\u00e0y gi\u1ea3i quy\u1ebft.",
            },
            {
                role: "body",
                brief: "N\u00f3i d\u1ecbch v\u1ee5 l\u00e0 g\u00ec, d\u00e0nh cho ai, trong m\u1ed9t c\u00e2u d\u1ec5 hi\u1ec3u.",
            },
            {
                role: "body",
                brief: "M\u1ed9t ho\u1eb7c hai \u0111i\u1ec3m kh\u00e1c bi\u1ec7t c\u00f3 th\u1eadt trong th\u00f4ng tin \u0111\u00e3 cung c\u1ea5p (quy tr\u00ecnh, c\u00e1ch l\u00e0m, cam k\u1ebft \u0111\u00e3 ghi).",
            },
            {
                role: "cta",
                brief: "M\u1eddi kh\u00e1ch nh\u1eafn tin ho\u1eb7c \u0111\u1eb7t l\u1ecbch, n\u00eau c\u00e1ch li\u00ean h\u1ec7 n\u1ebfu c\u00f3 trong th\u00f4ng tin.",
            },
        ],
        hint: {
            vi: "Cho kh\u00e1ch m\u1edbi hi\u1ec3u b\u1ea1n l\u00e0m g\u00ec, v\u00ec sao n\u00ean ch\u1ecdn b\u1ea1n.",
        },
    },
    custom: {
        label: {
            vi: "Tu\u1ef3 ch\u1ec9nh",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng \u0111i\u1ec1u kh\u00e1ch quan t\u00e2m nh\u1ea5t li\u00ean quan \u0111\u1ebfn m\u1ee5c \u0111\u00edch b\u1ea1n n\u00eau.",
            },
            {
                role: "body",
                brief: "Th\u00f4ng \u0111i\u1ec7p ch\u00ednh c\u1ee7a video, m\u1ed9t \u00fd duy nh\u1ea5t.",
            },
            {
                role: "body",
                brief: "Th\u00f4ng tin h\u1ed7 tr\u1ee3 c\u00f3 th\u1eadt (l\u00fd do, b\u1eb1ng ch\u1ee9ng, chi ti\u1ebft).",
            },
            {
                role: "cta",
                brief: "M\u1ed9t h\u00e0nh \u0111\u1ed9ng r\u00f5 r\u00e0ng kh\u00e1ch l\u00e0m ti\u1ebfp theo.",
            },
        ],
        hint: {
            vi: "B\u1ea1n t\u1ef1 n\u00f3i video n\u00e0y \u0111\u1ec3 l\u00e0m g\u00ec, NIVO so\u1ea1n theo.",
        },
    },
    hiring: {
        label: {
            vi: "Tuy\u1ec3n d\u1ee5ng",
        },
        scenes: [
            {
                role: "hook",
                brief: "M\u1edf b\u1eb1ng v\u1ecb tr\u00ed \u0111ang t\u00ecm ng\u01b0\u1eddi v\u00e0 m\u1ed9t l\u00fd do h\u1ea5p d\u1eabn c\u00f3 th\u1eadt.",
            },
            {
                role: "body",
                brief: "C\u00f4ng vi\u1ec7c h\u1eb1ng ng\u00e0y v\u00e0 y\u00eau c\u1ea7u ch\u00ednh, n\u00f3i th\u1eadt v\u00e0 ng\u1eafn.",
            },
            {
                role: "body",
                brief: "Quy\u1ec1n l\u1ee3i ch\u1ec9 khi c\u00f3 trong th\u00f4ng tin; kh\u00f4ng t\u1ef1 \u0111\u01b0a con s\u1ed1 l\u01b0\u01a1ng.",
            },
            {
                role: "cta",
                brief: "C\u00e1ch \u1ee9ng tuy\u1ec3n: g\u1eedi tin nh\u1eafn ho\u1eb7c li\u00ean h\u1ec7 theo th\u00f4ng tin \u0111\u00e3 cung c\u1ea5p.",
            },
        ],
        hint: {
            vi: "T\u00ecm ng\u01b0\u1eddi v\u00e0o \u0111\u1ed9i: v\u1ecb tr\u00ed, c\u00f4ng vi\u1ec7c, c\u00e1ch \u1ee9ng tuy\u1ec3n.",
        },
    },
}

/** The fact-safe Vietnamese marketing script instruction. */
export const VIDEO_SCRIPT_SYSTEM =
    'You write the script of a SHORT MARKETING VIDEO for a small business in Vietnam, scene by scene. Write in simple, natural Vietnamese in the shop\u0027s own voice (see the shop context). Use the shop\u0027s pronouns (xung ho) when the context gives them.\nRules: use ONLY facts that appear in the INFORMATION and the shop context. Never invent a price, discount, deadline, address, phone number, result, ranking or customer quote. If a fact is missing, speak in general terms or leave it out. No comparison with competitors, no guaranteed results, no medical or financial promises. Respect every \u0027claims to avoid\u0027 limit in the context.\nStructure: scene 1 is the HOOK (stops the scroll in 2 seconds), the middle scenes are the BODY (one idea each), the last scene is the CTA (one clear next step). Short sentences. No hashtags, no emoji.\nOutput: ONLY one JSON object, nothing before or after it: {"title": "short working title", "scenes": [{"role": "hook|body|cta", "caption": "words shown on screen, at most 60 characters", "voiceover": "what the voice says", "visual": "what the owner should show in this scene, in Vietnamese, one short phrase"}]}.'

/** One correction attempt for malformed agent JSON. */
export const VIDEO_SCRIPT_RETRY =
    "Your previous answer was not one valid JSON object. Return ONLY the JSON object described above."
