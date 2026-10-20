import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the gateway codes and the fixed lines it writes, Vietnamese and English. */
export const MCP_GATEWAY_MESSAGES: MessageBundle = {
    vi: {
        "errors.MCP_GATEWAY_UNKNOWN_TOOL": "Kết nối không có công cụ này.",
        "errors.MCP_GATEWAY_INVALID": "Dữ liệu kết nối không hợp lệ: {field}.",
        "errors.MCP_GATEWAY_AGENT_NOT_FOUND": "Không tìm thấy agent trong workspace.",
        "errors.MCP_GATEWAY_CREDENTIAL_MISSING": "Chưa có thông tin xác thực cho kết nối.",
        "errors.MCP_GATEWAY_TIMEOUT": "Kết nối trả lời quá chậm.",
    },
    en: {
        "errors.MCP_GATEWAY_UNKNOWN_TOOL": "The connector has no such tool.",
        "errors.MCP_GATEWAY_INVALID": "The connector input is not valid: {field}.",
        "errors.MCP_GATEWAY_AGENT_NOT_FOUND": "The agent is not in this workspace.",
        "errors.MCP_GATEWAY_CREDENTIAL_MISSING": "The connector has no credential yet.",
        "errors.MCP_GATEWAY_TIMEOUT": "The connector answered too slowly.",
    },
}
