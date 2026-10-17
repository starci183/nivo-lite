import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the channel-connections codes, Vietnamese and English. */
export const CHANNEL_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHANNEL_CONNECTIONS_TOKEN_FORMAT":
            "Đây không giống token bot Telegram. Token có dạng 123456789:AAE... - hãy sao chép lại từ @BotFather.",
        "errors.CHANNEL_CONNECTIONS_TOKEN_REJECTED":
            "Telegram từ chối token này. Hãy kiểm tra bạn đã sao chép đủ token từ @BotFather, hoặc tạo token mới bằng lệnh /token.",
        "errors.CHANNEL_CONNECTIONS_NETWORK": "Không kết nối được tới dịch vụ. Hãy kiểm tra mạng rồi thử lại.",
        "errors.CHANNEL_CONNECTIONS_BOT_IN_USE":
            "Bot này đang được kết nối ở một workspace khác. Hãy ngắt kết nối ở đó trước, hoặc tạo bot mới bằng @BotFather.",
        "errors.CHANNEL_CONNECTIONS_WEBHOOK_REFUSED": "Token hợp lệ, nhưng Telegram từ chối địa chỉ webhook.",
        "errors.CHANNEL_CONNECTIONS_ACCOUNT_INVALID": "Số tài khoản phải gồm 6 đến 20 chữ số.",
        "errors.CHANNEL_CONNECTIONS_BANK_FIELDS_MISSING": "Hãy nhập mã ngân hàng và chủ tài khoản.",
        "errors.CHANNEL_CONNECTIONS_API_KEY_INVALID":
            "API Key phải gồm 16 đến 128 ký tự: chữ, số, gạch ngang hoặc gạch dưới.",
        "errors.CHANNEL_CONNECTIONS_KEYS_INVALID": "Hãy dán đủ các khóa đúng như nhà cung cấp hiển thị.",
        "errors.CHANNEL_CONNECTIONS_PAYOS_CONFIRM_REFUSED":
            "payOS chưa chấp nhận địa chỉ webhook. Hãy kiểm tra Client ID và API Key rồi lưu khóa lại.",
        "errors.CHANNEL_CONNECTIONS_ZALO_TOKEN_REFUSED":
            "Zalo không chấp nhận token đã lưu. Bấm Kết nối lại để cấp quyền cho Official Account một lần nữa.",
        "errors.CHANNEL_CONNECTIONS_PROVIDER_UNSUPPORTED": "Có lỗi xảy ra. Bạn thử lại nhé.",
        "errors.CHANNEL_CONNECTIONS_FAILED": "Có lỗi xảy ra. Bạn thử lại nhé.",
    },
    en: {
        "errors.CHANNEL_CONNECTIONS_TOKEN_FORMAT":
            "That does not look like a Telegram bot token. It looks like 123456789:AAE... - copy it again from @BotFather.",
        "errors.CHANNEL_CONNECTIONS_TOKEN_REJECTED":
            "Telegram rejected this token. Check that you copied the whole token from @BotFather, or create a new one with /token.",
        "errors.CHANNEL_CONNECTIONS_NETWORK": "Could not reach the service. Check your connection and try again.",
        "errors.CHANNEL_CONNECTIONS_BOT_IN_USE":
            "This bot is already connected to a workspace. Disconnect it there first, or create another bot with @BotFather.",
        "errors.CHANNEL_CONNECTIONS_WEBHOOK_REFUSED":
            "The bot token is valid, but Telegram refused the webhook address.",
        "errors.CHANNEL_CONNECTIONS_ACCOUNT_INVALID": "The account number must be 6 to 20 digits.",
        "errors.CHANNEL_CONNECTIONS_BANK_FIELDS_MISSING": "Enter the bank code and the account holder.",
        "errors.CHANNEL_CONNECTIONS_API_KEY_INVALID":
            "The API key must be 16 to 128 letters, digits, dashes or underscores.",
        "errors.CHANNEL_CONNECTIONS_KEYS_INVALID": "Paste every key exactly as the provider shows it.",
        "errors.CHANNEL_CONNECTIONS_PAYOS_CONFIRM_REFUSED":
            "payOS did not accept the webhook address. Check the Client ID and API Key, then save the keys again.",
        "errors.CHANNEL_CONNECTIONS_ZALO_TOKEN_REFUSED":
            "Zalo did not accept the saved tokens. Press Reconnect to authorize the Official Account again.",
        "errors.CHANNEL_CONNECTIONS_PROVIDER_UNSUPPORTED": "Something went wrong. Please try again.",
        "errors.CHANNEL_CONNECTIONS_FAILED": "Something went wrong. Please try again.",
    },
}
