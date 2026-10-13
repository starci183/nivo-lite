import type { MessageBundle } from "@modules/platform/i18n"

/** The localized refusal and evidence lines of the lead actions. */
export const LEAD_ACTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LEAD_ACTIONS_BUSY": "Bước này đang được chuẩn bị. Vui lòng thử lại sau.",
        "errors.LEAD_ACTIONS_INVALID_INPUT": "Dữ liệu của bước này không hợp lệ.",
        "errors.LEAD_ACTIONS_NOT_FOUND": "Không tìm thấy yêu cầu hoặc khách hàng này.",
        "errors.LEAD_ACTIONS_NOT_WON": "Khách hàng này chưa chốt được giao dịch.",
        "errors.LEAD_ACTIONS_WORK_FAILED": "Không thể hoàn tất bước này.",
        "lead-actions.context": "Đã tạo tóm tắt bối cảnh khách hàng.",
        "lead-actions.owner": "{{name}} được giao cho {{owner}}. Bước tiếp: {{next}}.",
    },
    en: {
        "errors.LEAD_ACTIONS_BUSY": "This step is still being prepared. Please try again shortly.",
        "errors.LEAD_ACTIONS_INVALID_INPUT": "The action input is invalid.",
        "errors.LEAD_ACTIONS_NOT_FOUND": "That request or lead no longer exists.",
        "errors.LEAD_ACTIONS_NOT_WON": "That lead has not been won yet.",
        "errors.LEAD_ACTIONS_WORK_FAILED": "The action could not finish.",
        "lead-actions.context": "Created the customer context brief.",
        "lead-actions.owner": "{{name}} is assigned to {{owner}}. Next: {{next}}.",
    },
}
