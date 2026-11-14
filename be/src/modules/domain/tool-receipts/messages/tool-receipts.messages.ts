import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the gateway receipt codes, Vietnamese and English. */
export const TOOL_RECEIPTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.TOOL_RECEIPTS_UNREADABLE":
            "Không đọc được kết quả đã lưu; hãy kiểm tra trạng thái thao tác tại kết nối.",
    },
    en: {
        "errors.TOOL_RECEIPTS_UNREADABLE":
            "The stored operation result cannot be read; check the operation's state at the connector.",
    },
}
