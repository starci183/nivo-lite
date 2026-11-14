import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the model door: its error codes. */
export const AI_TASKS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AI_TASKS_JSON_NOT_RETURNED": "Mô hình không trả về JSON.",
        "errors.AI_TASKS_UNAVAILABLE": "Dịch vụ AI đang bận hoặc chưa được cấu hình. Vui lòng thử lại sau.",
        "errors.AI_TASKS_QUOTA_BLOCKED": "{{message}}",
    },
    en: {
        "errors.AI_TASKS_JSON_NOT_RETURNED": "The model did not return JSON.",
        "errors.AI_TASKS_UNAVAILABLE": "The AI service is busy or not configured. Please try again later.",
        "errors.AI_TASKS_QUOTA_BLOCKED": "{{message}}",
    },
}
