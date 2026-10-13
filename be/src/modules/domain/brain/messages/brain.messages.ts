import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the brain codes, Vietnamese and English. */
export const BRAIN_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_MODEL_UNAVAILABLE": "NIVO đang bận, sẽ thử lại.",
        "errors.BRAIN_COMMAND_NOT_FOUND": "Không tìm thấy yêu cầu này.",
    },
    en: {
        "errors.BRAIN_MODEL_UNAVAILABLE": "NIVO is busy and will try again.",
        "errors.BRAIN_COMMAND_NOT_FOUND": "This request was not found.",
    },
}
