import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the queue codes, Vietnamese and English. */
export const QUEUE_MESSAGES: MessageBundle = {
    vi: {
        "errors.QUEUE_DEFERRED_UNTIL": "Tác vụ {{job}} chờ quyền xử lý thêm {{seconds}} giây.",
        "errors.QUEUE_REDIS_CONFIGURATION_INVALID": "Redis của hàng đợi cần giới hạn bộ nhớ và chính sách noeviction.",
        "errors.QUEUE_REDIS_DEADLINE": "Thao tác Redis của hàng đợi vượt thời hạn xử lý.",
        "errors.QUEUE_SHUTDOWN_DEADLINE": "Tác vụ chưa kết thúc trước thời hạn dừng hàng đợi.",
        "errors.QUEUE_UNRECOVERABLE": "Tác vụ {{job}} dừng hẳn, không thử lại: {{reason}}.",
        "errors.QUEUE_RETRY_AFTER": "Tác vụ {{job}} sẽ chạy lại sau {{seconds}} giây: {{reason}}.",
        "errors.QUEUE_HANDLER_MISSING": "Không có bộ xử lý cho tác vụ {{job}} của hàng đợi {{queue}}.",
        "errors.QUEUE_HANDLER_DUPLICATED": "Tác vụ {{job}} của hàng đợi {{queue}} đã có bộ xử lý.",
    },
    en: {
        "errors.QUEUE_DEFERRED_UNTIL": "Job {{job}} waits {{seconds}} seconds for its processing claim.",
        "errors.QUEUE_REDIS_CONFIGURATION_INVALID": "Queue Redis requires a memory limit and the noeviction policy.",
        "errors.QUEUE_REDIS_DEADLINE": "A queue Redis operation exceeded its command deadline.",
        "errors.QUEUE_SHUTDOWN_DEADLINE": "A delivery did not settle before the queue shutdown deadline.",
        "errors.QUEUE_UNRECOVERABLE": "Job {{job}} stops for good, no retry: {{reason}}.",
        "errors.QUEUE_RETRY_AFTER": "Job {{job}} runs again in {{seconds}} seconds: {{reason}}.",
        "errors.QUEUE_HANDLER_MISSING": "No handler for job {{job}} of queue {{queue}}.",
        "errors.QUEUE_HANDLER_DUPLICATED": "Job {{job}} of queue {{queue}} already has a handler.",
    },
}
