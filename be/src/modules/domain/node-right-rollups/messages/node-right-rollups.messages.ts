import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the node-right roll-up codes, Vietnamese and English. */
export const NODE_RIGHT_ROLLUPS_MESSAGES: MessageBundle = {
    vi: {
        "errors.NODE_RIGHT_ROLLUPS_AGENT_NOT_FOUND": "Không tìm thấy agent này trong workspace.",
        "errors.NODE_RIGHT_ROLLUPS_TEMPLATE_VERSION_NOT_FOUND": "Mẫu quy trình này không có phiên bản đó.",
    },
    en: {
        "errors.NODE_RIGHT_ROLLUPS_AGENT_NOT_FOUND": "This workspace has no such agent.",
        "errors.NODE_RIGHT_ROLLUPS_TEMPLATE_VERSION_NOT_FOUND": "This workflow template has no such version.",
    },
}
