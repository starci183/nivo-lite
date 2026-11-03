import type { MessageBundle } from "@modules/platform/i18n"

/** The reason stored on a connection whose provider refused its credential: the owner reads it on Connections, in Vietnamese as the product does. */
export const POLL_NEEDS_REAUTH_REASON =
    "Kết nối bị nhà cung cấp từ chối (token hết hạn hoặc bị thu hồi). Hãy kết nối lại."

/** The reason stored on a connection whose provider says the credential lacks the permission to read messages: only the owner can grant it again. */
export const POLL_NEEDS_PERMISSION_REASON =
    "Kết nối chưa được cấp quyền đọc tin nhắn. Hãy kết nối lại và cấp quyền đọc tin nhắn."

/** Display text of the connection-poll codes, Vietnamese and English. */
export const CONNECTION_POLL_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONNECTION_POLL_DEFERRED":
            "Nhà cung cấp đang giới hạn tần suất đọc. Sẽ thử lại sau ít phút.",
    },
    en: {
        "errors.CONNECTION_POLL_DEFERRED": "The provider is limiting how often it can be read. It will be tried again shortly.",
    },
}
