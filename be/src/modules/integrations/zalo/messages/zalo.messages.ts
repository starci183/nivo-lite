import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Zalo codes, Vietnamese and English. */
export const ZALO_MESSAGES: MessageBundle = {
    vi: {
        "errors.ZALO_UNAVAILABLE": "Zalo hiện không phản hồi.",
        "errors.ZALO_REJECTED": "Zalo từ chối yêu cầu {{path}}: {{reason}}.",
        "errors.ZALO_BODY_UNREADABLE": "Nội dung webhook Zalo không đọc được.",
        "errors.ZALO_WINDOW_CLOSED":
            "Khách chưa tương tác với Official Account gần đây nên Zalo không cho gửi tin tư vấn.",
        "errors.ZALO_NOT_FOLLOWER": "Khách không còn quan tâm Official Account.",
        "errors.ZALO_NIGHT_HOURS": "Zalo không gửi loại tin này vào ban đêm.",
        "errors.ZALO_TOKEN_REJECTED": "Mã truy cập Zalo OA không hợp lệ hoặc đã hết hạn.",
        "errors.ZALO_RECIPIENT_UNREACHABLE":
            "Số điện thoại không hợp lệ, chưa có tài khoản Zalo hoặc khách đã tắt nhận thông báo.",
        "errors.ZALO_TEMPLATE_REJECTED": "Mẫu ZNS chưa được duyệt hoặc dữ liệu không khớp với mẫu.",
        "errors.ZALO_QUOTA_EXHAUSTED": "Official Account đã hết hạn mức gửi hoặc hết số dư ZNS.",
        "errors.ZALO_NOT_PERMITTED": "Official Account chưa được cấp quyền dùng tính năng này của Zalo.",
    },
    en: {
        "errors.ZALO_UNAVAILABLE": "Zalo is not answering.",
        "errors.ZALO_REJECTED": "Zalo refused the {{path}} request: {{reason}}.",
        "errors.ZALO_BODY_UNREADABLE": "The Zalo webhook body could not be read.",
        "errors.ZALO_WINDOW_CLOSED":
            "The customer has not interacted with the Official Account recently, so Zalo refuses a consultation message.",
        "errors.ZALO_NOT_FOLLOWER": "The customer no longer follows the Official Account.",
        "errors.ZALO_NIGHT_HOURS": "Zalo does not deliver this kind of message at night.",
        "errors.ZALO_TOKEN_REJECTED": "The Zalo OA access token is invalid or expired.",
        "errors.ZALO_RECIPIENT_UNREACHABLE":
            "The phone is not valid, has no Zalo account, or the customer turned notifications off.",
        "errors.ZALO_TEMPLATE_REJECTED": "The ZNS template is not approved, or the data does not fit it.",
        "errors.ZALO_QUOTA_EXHAUSTED": "The Official Account has used up its sending quota or its ZNS balance.",
        "errors.ZALO_NOT_PERMITTED": "The Official Account is not permitted to use this Zalo feature.",
    },
}
