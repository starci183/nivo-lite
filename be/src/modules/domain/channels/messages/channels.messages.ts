import type { MessageBundle } from "@modules/platform/i18n"

/** The reason stored on a Zalo connection whose refresh token Zalo refused: the owner reads it on Connections, in Vietnamese as the product does. */
export const ZALO_RECONNECT_REASON = "Zalo OA cần được kết nối lại (token hết hạn hoặc bị thu hồi). Bấm Kết nối lại."

/** Display text of the channels codes, Vietnamese and English. */
export const CHANNELS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHANNELS_CONNECTION_NOT_FOUND": "Không tìm thấy kết nối này.",
        "errors.CHANNELS_SECRET_UNREADABLE": "Không đọc được thông tin đăng nhập của kết nối.",
        "errors.CHANNELS_ZALO_NOT_AUTHORIZED": "Kết nối Zalo chưa được cấp quyền. Hãy bấm Kết nối lại.",
        "errors.CHANNELS_ZALO_REFRESH_BUSY": "Zalo đang làm mới mã truy cập, hãy thử lại sau giây lát.",
        "errors.CHANNELS_ZALO_STATE_REJECTED": "Phiên cấp quyền Zalo không hợp lệ.",
        "errors.CHANNELS_ZALO_STATE_EXPIRED": "Phiên cấp quyền Zalo đã hết hạn, hãy bắt đầu lại.",
    },
    en: {
        "errors.CHANNELS_CONNECTION_NOT_FOUND": "That connection was not found.",
        "errors.CHANNELS_SECRET_UNREADABLE": "The credential of the connection could not be read.",
        "errors.CHANNELS_ZALO_NOT_AUTHORIZED": "The Zalo connection is not authorized yet. Press Reconnect.",
        "errors.CHANNELS_ZALO_REFRESH_BUSY": "Zalo is refreshing the access token, try again in a moment.",
        "errors.CHANNELS_ZALO_STATE_REJECTED": "The Zalo authorization session is not valid.",
        "errors.CHANNELS_ZALO_STATE_EXPIRED": "The Zalo authorization session expired, start again.",
    },
}
