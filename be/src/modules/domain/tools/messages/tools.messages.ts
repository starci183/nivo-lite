import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the tools codes, Vietnamese and English. */
export const TOOLS_MESSAGES: MessageBundle = {
    vi: {
        "errors.TOOLS_INVALID_ARGUMENTS": "Tham số công cụ không hợp lệ.",
        "errors.TOOLS_UNKNOWN_TOOL": "Không có công cụ này.",
        "errors.TOOLS_INVALID": "Dữ liệu không hợp lệ: {field}.",
        "errors.TOOLS_AGENT_NOT_FOUND": "Không tìm thấy agent trong workspace.",
        "errors.TOOLS_TIMEOUT": "Công cụ trả lời quá chậm.",
        "errors.TOOLS_NATIVE_REFUSED": "Công cụ từ chối yêu cầu này: {reason}.",
        "errors.TOOLS_ATTACHMENT_REFUSED": "Không đổi được quyền của agent trên kết nối này: {reason}.",
        "errors.TOOLS_ACCOUNT_NEEDS_PICK":
            "Agent có nhiều tài khoản {provider} và chưa có tài khoản mặc định cho {tool}: hãy chọn một tài khoản mặc định ({connectionIds}).",
    },
    en: {
        "errors.TOOLS_INVALID_ARGUMENTS": "The tool arguments are not valid.",
        "errors.TOOLS_UNKNOWN_TOOL": "There is no such tool.",
        "errors.TOOLS_INVALID": "The input is not valid: {field}.",
        "errors.TOOLS_AGENT_NOT_FOUND": "The agent is not in this workspace.",
        "errors.TOOLS_TIMEOUT": "The tool answered too slowly.",
        "errors.TOOLS_NATIVE_REFUSED": "The tool refused this request: {reason}.",
        "errors.TOOLS_ATTACHMENT_REFUSED": "The agent's rights on this provider cannot be changed: {reason}.",
        "errors.TOOLS_ACCOUNT_NEEDS_PICK":
            "The agent holds several {provider} accounts and has no default account for {tool}: pick a default account ({connectionIds}).",
    },
}
