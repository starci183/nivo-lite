import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the messages codes, Vietnamese and English. */
export const MESSAGES_MESSAGES: MessageBundle = {
    vi: {
        "errors.MESSAGES_CARD_INVALID": "Thẻ kết quả không hợp lệ: {{reason}}.",
        "errors.MESSAGES_ROOM_INVALID": "Không có phòng {{room}}.",
    },
    en: {
        "errors.MESSAGES_CARD_INVALID": "The result card is invalid: {{reason}}.",
        "errors.MESSAGES_ROOM_INVALID": "There is no room {{room}}.",
    },
}
