import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the ffmpeg codes, Vietnamese and English. */
export const FFMPEG_MESSAGES: MessageBundle = {
    vi: {
        "errors.FFMPEG_FAILED": "M\u00e1y d\u1ef1ng video g\u1eb7p l\u1ed7i ({{tool}}: {{reason}}).",
    },
    en: {
        "errors.FFMPEG_FAILED": "The video renderer failed ({{tool}}: {{reason}}).",
    },
}
