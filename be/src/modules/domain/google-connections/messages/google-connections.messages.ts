import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the google-connections codes and of the spreadsheet automation runs, Vietnamese and English. */
export const GOOGLE_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.GOOGLE_CONNECTIONS_NOT_CONFIGURED": "Google chưa được thiết lập trên NIVO này. Bạn thử lại sau nhé.",
        "errors.GOOGLE_CONNECTIONS_START_FAILED": "Chưa bắt đầu được kết nối Google. Bạn thử lại nhé.",
        "errors.GOOGLE_CONNECTIONS_MISSING": "Chưa có tài khoản Google nào được kết nối.",
        "errors.GOOGLE_CONNECTIONS_LOST": "Kết nối Google đã bị thu hồi. Hãy kết nối lại.",
        "errors.GOOGLE_CONNECTIONS_SCOPE_MISSING": "Bạn chưa tick quyền đọc Google Drive trên màn hình đồng ý của Google.",
        "googleConnections.sheetTitle": "NIVO · Đơn hàng · {{name}}",
        "googleConnections.sheetOrders.written": "Đã ghi vào Google Sheet",
        "googleConnections.sheetOrders.skipped": "Bỏ qua",
        "googleConnections.sheetOrders.skippedDetail": "Bạn đã tắt ghi loại sự kiện này.",
    },
    en: {
        "errors.GOOGLE_CONNECTIONS_NOT_CONFIGURED": "Google is not set up on this NIVO yet. Please try again later.",
        "errors.GOOGLE_CONNECTIONS_START_FAILED": "Could not start the Google connection. Please try again.",
        "errors.GOOGLE_CONNECTIONS_MISSING": "No Google account is connected.",
        "errors.GOOGLE_CONNECTIONS_LOST": "The Google connection was revoked. Connect it again.",
        "errors.GOOGLE_CONNECTIONS_SCOPE_MISSING": "The Google Drive read access was not ticked on the Google consent screen.",
        "googleConnections.sheetTitle": "NIVO · Orders · {{name}}",
        "googleConnections.sheetOrders.written": "Written to Google Sheets",
        "googleConnections.sheetOrders.skipped": "Skipped",
        "googleConnections.sheetOrders.skippedDetail": "You switched off recording this kind of event.",
    },
}
