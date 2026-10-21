import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the MCP integration codes, Vietnamese and English. */
export const MCP_MESSAGES: MessageBundle = {
    vi: {
        "errors.MCP_TIMEOUT": "Máy chủ MCP trả lời quá chậm.",
        "errors.MCP_UNAVAILABLE": "Không kết nối được máy chủ MCP.",
        "errors.MCP_CREDENTIAL_MISSING": "Chưa có thông tin xác thực cho máy chủ MCP này.",
    },
    en: {
        "errors.MCP_TIMEOUT": "The MCP server answered too slowly.",
        "errors.MCP_UNAVAILABLE": "The MCP server could not be reached.",
        "errors.MCP_CREDENTIAL_MISSING": "There is no credential for this MCP server yet.",
    },
}
