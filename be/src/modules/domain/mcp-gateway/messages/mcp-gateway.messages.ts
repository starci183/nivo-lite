import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the gateway codes, Vietnamese and English. */
export const MCP_GATEWAY_MESSAGES: MessageBundle = {
    vi: {
        "errors.MCP_GATEWAY_INVALID_ARGUMENTS": "Tham số công cụ không hợp lệ.",
        "errors.MCP_GATEWAY_UNKNOWN_TOOL": "Kết nối không có công cụ này.",
        "errors.MCP_GATEWAY_INVALID": "Dữ liệu kết nối không hợp lệ: {field}.",
        "errors.MCP_GATEWAY_AGENT_NOT_FOUND": "Không tìm thấy agent trong workspace.",
        "errors.MCP_GATEWAY_CREDENTIAL_MISSING": "Chưa có thông tin xác thực cho kết nối.",
        "errors.MCP_GATEWAY_CREDENTIAL_UNREADABLE":
            "Không đọc được thông tin xác thực đã lưu của kết nối; hãy nhập lại.",
        "errors.MCP_GATEWAY_TIMEOUT": "Kết nối trả lời quá chậm.",
        "errors.MCP_GATEWAY_WORKSPACE_MISMATCH": "Thông tin xác thực của agent không thuộc workspace này.",
        "errors.MCP_GATEWAY_CATALOG_CHANGED":
            "Danh sách công cụ chưa được đọc hoặc vừa thay đổi; hãy đọc lại rồi duyệt.",
        "errors.MCP_GATEWAY_NATIVE_REFUSED": "Công cụ từ chối yêu cầu này: {reason}.",
    },
    en: {
        "errors.MCP_GATEWAY_INVALID_ARGUMENTS": "The tool arguments are not valid.",
        "errors.MCP_GATEWAY_UNKNOWN_TOOL": "The connector has no such tool.",
        "errors.MCP_GATEWAY_INVALID": "The connector input is not valid: {field}.",
        "errors.MCP_GATEWAY_AGENT_NOT_FOUND": "The agent is not in this workspace.",
        "errors.MCP_GATEWAY_CREDENTIAL_MISSING": "The connector has no credential yet.",
        "errors.MCP_GATEWAY_CREDENTIAL_UNREADABLE":
            "The stored credential of the connector cannot be read; enter it again.",
        "errors.MCP_GATEWAY_TIMEOUT": "The connector answered too slowly.",
        "errors.MCP_GATEWAY_WORKSPACE_MISMATCH": "The agent's credential does not act for this workspace.",
        "errors.MCP_GATEWAY_CATALOG_CHANGED":
            "The tool catalog was not read or just changed; read it again, then approve.",
        "errors.MCP_GATEWAY_NATIVE_REFUSED": "The tool refused this request: {reason}.",
    },
}
