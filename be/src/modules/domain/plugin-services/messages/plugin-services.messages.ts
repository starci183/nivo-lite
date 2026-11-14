import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the plugin services codes, Vietnamese and English. */
export const PLUGIN_SERVICES_MESSAGES: MessageBundle = {
    vi: {
        "errors.PLUGIN_SERVICES_AGENT_UNKNOWN": "Không tìm thấy agent này trong workspace.",
        "errors.PLUGIN_SERVICES_SERVICE_MISSING": "Mô-đun của agent này chưa cài dịch vụ mà việc này cần.",
        "errors.PLUGIN_SERVICES_SCOPE_MISMATCH": "Giao dịch đang mở không thuộc workspace hoặc agent của việc này.",
    },
    en: {
        "errors.PLUGIN_SERVICES_AGENT_UNKNOWN": "This workspace has no such agent.",
        "errors.PLUGIN_SERVICES_SERVICE_MISSING": "The module of this agent has not installed the service this needs.",
        "errors.PLUGIN_SERVICES_SCOPE_MISMATCH": "The open transaction is not of this workspace or this agent.",
    },
}
