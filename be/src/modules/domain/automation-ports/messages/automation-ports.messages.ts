import type { MessageBundle } from "@modules/platform/i18n"

/** The lines the automation ports write: who approves a message the owner let send by itself. */
export const AUTOMATION_PORTS_MESSAGES: MessageBundle = {
    vi: {
        "automationPorts.autoSendBy": "Tự gửi (chủ shop đã cho phép)",
        "automationPorts.autoSendNote": "Tự động hoá được chủ shop cho phép tự gửi.",
    },
    en: {
        "automationPorts.autoSendBy": "Sent by itself (allowed by the owner)",
        "automationPorts.autoSendNote": "The owner allowed this automation to send by itself.",
    },
}
