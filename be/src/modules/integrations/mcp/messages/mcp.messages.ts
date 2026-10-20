import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the remote MCP client codes, Vietnamese and English. */
export const MCP_MESSAGES: MessageBundle = {
    vi: {
        "errors.MCP_TIMEOUT": "Máy chủ MCP trả lời quá chậm.",
        "errors.MCP_UNAVAILABLE": "Không kết nối được máy chủ MCP.",
    },
    en: {
        "errors.MCP_TIMEOUT": "The MCP server answered too slowly.",
        "errors.MCP_UNAVAILABLE": "The MCP server could not be reached.",
    },
}
