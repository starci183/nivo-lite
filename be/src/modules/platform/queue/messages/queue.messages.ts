import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the queue codes, Vietnamese and English. */
export const QUEUE_MESSAGES: MessageBundle = {
    vi: {
        "errors.QUEUE_UNRECOVERABLE": "Tác vụ {{job}} dừng hẳn, không thử lại: {{reason}}.",
        "errors.QUEUE_RETRY_AFTER": "Tác vụ {{job}} sẽ chạy lại sau {{seconds}} giây: {{reason}}.",
        "errors.QUEUE_HANDLER_MISSING": "Không có bộ xử lý cho tác vụ {{job}} của hàng đợi {{queue}}.",
        "errors.QUEUE_HANDLER_DUPLICATED": "Tác vụ {{job}} của hàng đợi {{queue}} đã có bộ xử lý.",
    },
    en: {
        "errors.QUEUE_UNRECOVERABLE": "Job {{job}} stops for good, no retry: {{reason}}.",
        "errors.QUEUE_RETRY_AFTER": "Job {{job}} runs again in {{seconds}} seconds: {{reason}}.",
        "errors.QUEUE_HANDLER_MISSING": "No handler for job {{job}} of queue {{queue}}.",
        "errors.QUEUE_HANDLER_DUPLICATED": "Job {{job}} of queue {{queue}} already has a handler.",
    },
}
