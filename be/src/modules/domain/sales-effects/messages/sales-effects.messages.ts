import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the sales-effects codes, Vietnamese and English. */
export const SALES_EFFECTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.SALES_EFFECTS_INVALID_PAYLOAD": "Dữ liệu của bước này không đúng dạng.",
        "errors.SALES_EFFECTS_CONVERSATION_NOT_FOUND": "Không tìm thấy cuộc trò chuyện.",
        "errors.SALES_EFFECTS_LEAD_NOT_FOUND": "Không tìm thấy khách hàng của đơn.",
        "errors.SALES_EFFECTS_ORDER_NOT_FOUND": "Không tìm thấy đơn hàng.",
        "errors.SALES_EFFECTS_WRITE_REFUSED": "Không ghi được: bản ghi vừa đổi hoặc vi phạm một quy tắc.",
    },
    en: {
        "errors.SALES_EFFECTS_INVALID_PAYLOAD": "The data of this step is not in the expected shape.",
        "errors.SALES_EFFECTS_CONVERSATION_NOT_FOUND": "The conversation was not found.",
        "errors.SALES_EFFECTS_LEAD_NOT_FOUND": "The customer of the order was not found.",
        "errors.SALES_EFFECTS_ORDER_NOT_FOUND": "The order was not found.",
        "errors.SALES_EFFECTS_WRITE_REFUSED": "The write was refused: the record just changed or broke a rule.",
    },
}
