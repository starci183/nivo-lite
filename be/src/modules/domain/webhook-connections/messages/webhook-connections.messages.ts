import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the webhook-connections codes, Vietnamese and English. */
export const WEBHOOK_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.WEBHOOK_CONNECTIONS_EVENTS_EMPTY": "Chọn ít nhất một sự kiện để gửi.",
        "errors.WEBHOOK_CONNECTIONS_NAME_INVALID": "Đặt tên cho kết nối (ít nhất 2 ký tự), ví dụ: n8n của shop.",
        "errors.WEBHOOK_CONNECTIONS_URL_REFUSED": "Địa chỉ webhook không dùng được.",
        "errors.WEBHOOK_CONNECTIONS_SIGNING_UNAVAILABLE": "NIVO chưa bật chữ ký cho webhook trên máy chủ này.",
        "errors.WEBHOOK_CONNECTIONS_NO_URL": "Kết nối này chưa có địa chỉ webhook.",
        "errors.WEBHOOK_CONNECTIONS_DELIVERY_FAILED": "Webhook chưa nhận sự kiện (mã {{status}}); NIVO sẽ gửi lại.",
    },
    en: {
        "errors.WEBHOOK_CONNECTIONS_EVENTS_EMPTY": "Pick at least one event to send.",
        "errors.WEBHOOK_CONNECTIONS_NAME_INVALID": "Name the connection (at least 2 characters), for example: the n8n of the shop.",
        "errors.WEBHOOK_CONNECTIONS_URL_REFUSED": "This webhook address cannot be used.",
        "errors.WEBHOOK_CONNECTIONS_SIGNING_UNAVAILABLE": "Webhook signing is not switched on on this server.",
        "errors.WEBHOOK_CONNECTIONS_NO_URL": "This connection has no webhook address yet.",
        "errors.WEBHOOK_CONNECTIONS_DELIVERY_FAILED": "The webhook did not take the event yet (status {{status}}); NIVO will send it again.",
    },
}
