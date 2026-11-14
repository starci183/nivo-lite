import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the outbound MCP endpoint codes, Vietnamese and English. */
export const MCP_ENDPOINT_MESSAGES: MessageBundle = {
    vi: {
        "errors.MCP_ENDPOINT_WORKSPACE_MISMATCH": "Khoá API này không thuộc workspace này.",
        "errors.MCP_ENDPOINT_KEY_GONE": "Khoá API này đã bị thu hồi, hoặc người tạo khoá không còn trong workspace.",
    },
    en: {
        "errors.MCP_ENDPOINT_WORKSPACE_MISMATCH": "This API key does not act for this workspace.",
        "errors.MCP_ENDPOINT_KEY_GONE": "This API key was revoked, or the member who created it left the workspace.",
    },
}
