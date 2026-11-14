import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the brain codes, Vietnamese and English. */
export const BRAIN_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_MODEL_UNAVAILABLE": "NIVO đang bận, sẽ thử lại.",
        "errors.BRAIN_COMMAND_NOT_FOUND": "Không tìm thấy yêu cầu này.",
        "errors.BRAIN_BULK_NEEDS_INTERNAL":
            "Chỉ áp dụng cùng lúc cho tài liệu nội bộ. Với tài liệu công khai, hãy xem từng sự thật.",
        "errors.BRAIN_WINDOW_INVALID": "Ngày hết hiệu lực phải sau ngày bắt đầu.",
        "errors.BRAIN_SETTLE_LOST_RACE": "Một tài liệu khác vừa thay đổi sự thật này; sẽ xem lại.",
    },
    en: {
        "errors.BRAIN_MODEL_UNAVAILABLE": "NIVO is busy and will try again.",
        "errors.BRAIN_COMMAND_NOT_FOUND": "This request was not found.",
        "errors.BRAIN_BULK_NEEDS_INTERNAL":
            "Facts are applied together only from internal documents. For a public document, review each fact.",
        "errors.BRAIN_WINDOW_INVALID": "The end of the validity must come after its start.",
        "errors.BRAIN_SETTLE_LOST_RACE": "Another document just changed this truth; it will be looked at again.",
    },
}
