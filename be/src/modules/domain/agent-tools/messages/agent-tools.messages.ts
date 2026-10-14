import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent tools codes, Vietnamese and English. */
export const AGENT_TOOLS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_TOOLS_TOKEN_INVALID": "Mã công cụ không hợp lệ, đã hết hạn hoặc đã dùng hết lượt.",
        "errors.AGENT_TOOLS_UNKNOWN_TOOL": "Công cụ {{tool}} không tồn tại.",
        "errors.AGENT_TOOLS_ARGUMENT_MISSING": "Thiếu tham số bắt buộc: {{field}}.",
    },
    en: {
        "errors.AGENT_TOOLS_TOKEN_INVALID": "The tool token is invalid, expired or exhausted.",
        "errors.AGENT_TOOLS_UNKNOWN_TOOL": "The tool {{tool}} does not exist.",
        "errors.AGENT_TOOLS_ARGUMENT_MISSING": "A required argument is missing: {{field}}.",
    },
}
