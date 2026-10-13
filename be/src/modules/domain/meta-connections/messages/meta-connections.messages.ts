import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the meta-connections codes, Vietnamese and English. */
export const META_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.META_CONNECTIONS_NOT_CONFIGURED": "Tích hợp Facebook chưa được thiết lập trên NIVO này. Bạn thử lại sau nhé.",
        "errors.META_CONNECTIONS_NO_PAGE": "Hãy chọn một Page trước.",
        "errors.META_CONNECTIONS_PAGE_GONE": "Page đó không còn trong danh sách của bạn. Hãy đăng nhập Facebook lại.",
        "errors.META_CONNECTIONS_PAGE_IN_USE": "Page này (hoặc tài khoản Instagram của nó) đã được kết nối ở một kết nối khác.",
        "errors.META_CONNECTIONS_TOKEN_REFUSED": "Meta từ chối quyền truy cập của NIVO. Hãy đăng nhập Facebook lại.",
        "errors.META_CONNECTIONS_PERMISSION_REFUSED":
            "Meta không cho phép thao tác này. Hãy đăng nhập lại và cấp đủ mọi quyền, hoặc kiểm tra bạn là quản trị viên của Page.",
        "errors.META_CONNECTIONS_RATE_LIMITED": "Meta đang giới hạn yêu cầu. Bạn đợi một phút rồi thử lại nhé.",
        "errors.META_CONNECTIONS_NETWORK": "Không kết nối được tới Meta. Hãy kiểm tra mạng rồi thử lại.",
        "errors.META_CONNECTIONS_FAILED": "Có lỗi với Meta. Bạn thử lại nhé.",
    },
    en: {
        "errors.META_CONNECTIONS_NOT_CONFIGURED": "The Facebook integration is not set up on this NIVO yet. Please try again later.",
        "errors.META_CONNECTIONS_NO_PAGE": "Pick a Page first.",
        "errors.META_CONNECTIONS_PAGE_GONE": "That Page is no longer in your list. Log in with Facebook again.",
        "errors.META_CONNECTIONS_PAGE_IN_USE": "This Page (or its Instagram account) is already connected in another connection.",
        "errors.META_CONNECTIONS_TOKEN_REFUSED": "Meta refused access for NIVO. Log in with Facebook again.",
        "errors.META_CONNECTIONS_PERMISSION_REFUSED":
            "Meta did not allow this. Log in again and allow every permission, or check that you are an admin of the Page.",
        "errors.META_CONNECTIONS_RATE_LIMITED": "Meta is limiting requests right now. Please wait a minute and try again.",
        "errors.META_CONNECTIONS_NETWORK": "Could not reach Meta. Please check the connection and try again.",
        "errors.META_CONNECTIONS_FAILED": "Something went wrong with Meta. Please try again.",
    },
}
