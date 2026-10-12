import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the OpenClaw codes, Vietnamese and English. */
export const OPENCLAW_MESSAGES: MessageBundle = {
    vi: {
        "errors.OPENCLAW_CONFIG_INVALID": "Cấu hình OpenClaw không hợp lệ: {{key}}.",
        "errors.OPENCLAW_GATEWAY_NOT_CONFIGURED": "OpenClaw chưa được cấu hình.",
        "errors.OPENCLAW_GATEWAY_REFUSED": "OpenClaw từ chối yêu cầu {{method}}.",
        "errors.OPENCLAW_GATEWAY_DEFERRED": "OpenClaw đang khởi động, thử kết nối lại sau {{retryAfterMs}} ms.",
        "errors.OPENCLAW_GATEWAY_TIMEOUT": "OpenClaw không trả lời trong {{timeoutMs}} ms.",
        "errors.OPENCLAW_GATEWAY_ABORTED": "Lượt chat đã bị hủy.",
        "errors.OPENCLAW_GATEWAY_CLOSED": "OpenClaw đóng kết nối trước khi trả lời.",
        "errors.OPENCLAW_GATEWAY_SOCKET_FAILED": "Kết nối tới OpenClaw bị lỗi.",
        "errors.OPENCLAW_RUN_FAILED": "Lượt chạy trên OpenClaw kết thúc với lỗi.",
        "errors.OPENCLAW_REGISTRATION_OFF": "Chưa bật đăng ký agent OpenClaw.",
        "errors.OPENCLAW_WORKSPACE_PATH_UNSAFE": "Đường dẫn không an toàn trong bộ agent: {{path}}.",
        "errors.OPENCLAW_WORKSPACE_UNAVAILABLE": "Chưa cấu hình thư mục ghi workspace của agent.",
    },
    en: {
        "errors.OPENCLAW_CONFIG_INVALID": "The OpenClaw configuration is invalid: {{key}}.",
        "errors.OPENCLAW_GATEWAY_NOT_CONFIGURED": "OpenClaw is not configured.",
        "errors.OPENCLAW_GATEWAY_REFUSED": "OpenClaw refused the {{method}} request.",
        "errors.OPENCLAW_GATEWAY_DEFERRED":
            "OpenClaw is still starting; the connect is retried after {{retryAfterMs}} ms.",
        "errors.OPENCLAW_GATEWAY_TIMEOUT": "OpenClaw did not answer within {{timeoutMs}} ms.",
        "errors.OPENCLAW_GATEWAY_ABORTED": "The chat turn was aborted.",
        "errors.OPENCLAW_GATEWAY_CLOSED": "OpenClaw closed the connection before it answered.",
        "errors.OPENCLAW_GATEWAY_SOCKET_FAILED": "The connection to OpenClaw failed.",
        "errors.OPENCLAW_RUN_FAILED": "The run on OpenClaw ended in error.",
        "errors.OPENCLAW_REGISTRATION_OFF": "OpenClaw agent registration is switched off.",
        "errors.OPENCLAW_WORKSPACE_PATH_UNSAFE": "A path of the agent bundle is unsafe: {{path}}.",
        "errors.OPENCLAW_WORKSPACE_UNAVAILABLE": "The agent workspace directory is not configured.",
    },
}
