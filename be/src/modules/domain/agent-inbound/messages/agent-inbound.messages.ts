import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-inbound codes, Vietnamese and English. */
export const AGENT_INBOUND_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_INBOUND_ADAPTER_UNKNOWN": "Nguồn sự kiện {{adapter}} chưa được đăng ký.",
        "errors.AGENT_INBOUND_ADAPTER_DUPLICATE": "Nguồn sự kiện {{adapter}} đã được đăng ký.",
        "errors.AGENT_INBOUND_PAYLOAD_TOO_LARGE": "Nội dung sự kiện quá lớn.",
        "errors.AGENT_INBOUND_KEY_MISSING": "Sự kiện thiếu khóa chống trùng.",
        "errors.AGENT_INBOUND_STOP_NOT_REPORTABLE": "Chuỗi agent bị dừng nhưng chưa có cách báo cho người phụ trách.",
        "errors.AGENT_INBOUND_BODY_INVALID": "Nội dung webhook phải là một đối tượng JSON.",
        "errors.AGENT_INBOUND_EVENT_TYPE_INVALID": "Webhook chưa nêu loại sự kiện hợp lệ.",
        "errors.AGENT_INBOUND_ENDPOINT_UNKNOWN": "Không tìm thấy điểm nhận webhook này.",
        "errors.AGENT_INBOUND_JOB_PAYLOAD_INVALID": "Việc cần chạy không nêu sự kiện nào.",
    },
    en: {
        "errors.AGENT_INBOUND_ADAPTER_UNKNOWN": "The event source {{adapter}} is not registered.",
        "errors.AGENT_INBOUND_ADAPTER_DUPLICATE": "The event source {{adapter}} is already registered.",
        "errors.AGENT_INBOUND_PAYLOAD_TOO_LARGE": "The event payload is too large.",
        "errors.AGENT_INBOUND_KEY_MISSING": "The event has no idempotency key.",
        "errors.AGENT_INBOUND_STOP_NOT_REPORTABLE": "An agent chain stopped and there is no way to tell a person.",
        "errors.AGENT_INBOUND_BODY_INVALID": "The webhook body must be a JSON object.",
        "errors.AGENT_INBOUND_EVENT_TYPE_INVALID": "The webhook names no valid event type.",
        "errors.AGENT_INBOUND_ENDPOINT_UNKNOWN": "That webhook endpoint was not found.",
        "errors.AGENT_INBOUND_JOB_PAYLOAD_INVALID": "The job names no event.",
    },
}
