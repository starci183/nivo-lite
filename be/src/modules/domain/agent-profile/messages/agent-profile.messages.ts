import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent profile codes, Vietnamese and English. */
export const AGENT_PROFILE_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_PROFILE_ASSIGN_FORBIDDEN": "Bạn chưa được phép giao việc cho agent này.",
        "errors.AGENT_PROFILE_REQUEST_INVALID": "Nội dung giao việc cần từ 1 đến {{max}} ký tự.",
        "errors.AGENT_PROFILE_THREADS_UNBOUND": "Ứng dụng này chưa có luồng việc để ghi lại việc được giao.",
        "errors.AGENT_PROFILE_AGENT_NOT_FOUND": "Không tìm thấy agent.",
    },
    en: {
        "errors.AGENT_PROFILE_ASSIGN_FORBIDDEN": "You are not allowed to give this agent work.",
        "errors.AGENT_PROFILE_REQUEST_INVALID": "The request must be 1 to {{max}} characters.",
        "errors.AGENT_PROFILE_THREADS_UNBOUND": "This app has no work threads to record the assignment in.",
        "errors.AGENT_PROFILE_AGENT_NOT_FOUND": "The agent was not found.",
    },
}
