import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the nivo-knowledge codes, Vietnamese and English. */
export const NIVO_KNOWLEDGE_MESSAGES: MessageBundle = {
    vi: {
        "errors.NIVO_KNOWLEDGE_FRONT_MATTER_MISSING": "T\u1ec7p tri th\u1ee9c {{file}} thi\u1ebfu kh\u1ed1i th\u00f4ng tin \u0111\u1ea7u t\u1ec7p.",
        "errors.NIVO_KNOWLEDGE_MODULE_UNKNOWN": "T\u1ec7p tri th\u1ee9c {{file}} n\u1eb1m trong th\u01b0 m\u1ee5c kh\u00f4ng ph\u1ea3i module n\u00e0o.",
        "errors.NIVO_KNOWLEDGE_KIND_UNKNOWN": "T\u1ec7p tri th\u1ee9c {{file}} c\u00f3 lo\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.NIVO_KNOWLEDGE_TITLE_MISSING": "T\u1ec7p tri th\u1ee9c {{file}} thi\u1ebfu ti\u00eau \u0111\u1ec1.",
        "errors.NIVO_KNOWLEDGE_SLUG_DUPLICATE": "T\u1ec7p tri th\u1ee9c {{file}} tr\u00f9ng m\u00e3 v\u1edbi m\u1ed9t t\u1ec7p kh\u00e1c.",
    },
    en: {
        "errors.NIVO_KNOWLEDGE_FRONT_MATTER_MISSING": "The knowledge file {{file}} has no front matter block.",
        "errors.NIVO_KNOWLEDGE_MODULE_UNKNOWN": "The knowledge file {{file}} sits in a folder that is not a module.",
        "errors.NIVO_KNOWLEDGE_KIND_UNKNOWN": "The knowledge file {{file}} has an unknown kind.",
        "errors.NIVO_KNOWLEDGE_TITLE_MISSING": "The knowledge file {{file}} has no title.",
        "errors.NIVO_KNOWLEDGE_SLUG_DUPLICATE": "The knowledge file {{file}} shares its slug with another file.",
    },
}
