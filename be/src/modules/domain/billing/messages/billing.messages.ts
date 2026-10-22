import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the billing codes and of the lines billing writes into customer-visible records, Vietnamese and English. */
export const BILLING_MESSAGES: MessageBundle = {
    vi: {
        "errors.BILLING_FORBIDDEN":
            "Ch\u1ec9 ch\u1ee7 s\u1edf h\u1eefu ho\u1eb7c qu\u1ea3n l\u00fd m\u1edbi thanh to\u00e1n \u0111\u01b0\u1ee3c.",
        "errors.BILLING_NOT_MEMBER": "B\u1ea1n kh\u00f4ng thu\u1ed9c workspace n\u00e0y.",
        "errors.BILLING_WORKSPACE_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y workspace ho\u1eb7c workspace ch\u01b0a c\u00f3 g\u00f3i.",
        "errors.BILLING_PLAN_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y g\u00f3i {{plan}}.",
        "errors.BILLING_PLAN_CUSTOM":
            "G\u00f3i h\u1ee3p \u0111\u1ed3ng kh\u00f4ng mua \u0111\u01b0\u1ee3c trong \u1ee9ng d\u1ee5ng, h\u00e3y li\u00ean h\u1ec7 NIVO.",
        "errors.BILLING_WEBHOOK_UNAUTHORIZED": "Webhook kh\u00f4ng \u0111\u01b0\u1ee3c x\u00e1c th\u1ef1c.",
        "errors.BILLING_WEBHOOK_INVALID": "D\u1eef li\u1ec7u webhook kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.BILLING_CREDENTIAL_UNREADABLE":
            "Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c th\u00f4ng tin k\u1ebft n\u1ed1i \u0111\u00e3 l\u01b0u.",
        "errors.BILLING_PLAN_NOT_LISTED": "Gói này không còn bán, hãy chọn một gói khác.",
        "errors.BILLING_CYCLE_UNAVAILABLE": "Gói này không bán theo chu kỳ thanh toán đã chọn.",
        "errors.BILLING_TIER_UNKNOWN": "Mức credit đã chọn không có trong gói này.",
        "errors.BILLING_TIER_REQUIRED": "Hãy chọn mức credit AI cho mỗi ghế.",
        "errors.BILLING_SEATS_INVALID": "Số ghế phải từ 1 đến {{max}}.",
        "errors.BILLING_PLAN_INDIVIDUAL_ONLY":
            "Gói cá nhân chỉ dành cho một người. Hãy nâng lên gói Team để mời thành viên.",
        "errors.BILLING_SEAT_LIMIT_REACHED": "Đã dùng hết các ghế đã mua. Hãy thêm ghế trước khi mời thêm người.",
        "errors.BILLING_STORAGE_QUOTA_EXCEEDED":
            "Đã đầy dung lượng lưu trữ của gói ({{quotaGb}} GB). Hãy xóa bớt tệp hoặc nâng cấp gói.",
        "billing.bankEventBody": "{{bank}} b\u00e1o c\u00f3: {{content}}",
        "billing.manualBank": "Thủ công",
        "billing.manualEvidenceLog": "Ghi nhận thủ công {{amount}} đ ngày {{date}}",
    },
    en: {
        "errors.BILLING_FORBIDDEN": "Only an owner or a manager can pay.",
        "errors.BILLING_NOT_MEMBER": "You are not a member of this workspace.",
        "errors.BILLING_WORKSPACE_NOT_FOUND": "The workspace was not found or has no plan yet.",
        "errors.BILLING_PLAN_NOT_FOUND": "The plan {{plan}} was not found.",
        "errors.BILLING_PLAN_CUSTOM": "A contract plan cannot be bought in the app, please contact NIVO.",
        "errors.BILLING_WEBHOOK_UNAUTHORIZED": "The webhook is not authenticated.",
        "errors.BILLING_WEBHOOK_INVALID": "The webhook payload is not valid.",
        "errors.BILLING_CREDENTIAL_UNREADABLE": "The stored connection credential could not be read.",
        "errors.BILLING_PLAN_NOT_LISTED": "This plan is no longer sold, please choose another plan.",
        "errors.BILLING_CYCLE_UNAVAILABLE": "This plan is not sold for the billing cycle you chose.",
        "errors.BILLING_TIER_UNKNOWN": "The credit level you chose is not available on this plan.",
        "errors.BILLING_TIER_REQUIRED": "Choose the AI credit level of each seat.",
        "errors.BILLING_SEATS_INVALID": "Seats must be between 1 and {{max}}.",
        "errors.BILLING_PLAN_INDIVIDUAL_ONLY":
            "An individual plan is for one person. Upgrade to Team to invite members.",
        "errors.BILLING_SEAT_LIMIT_REACHED": "Every paid seat is taken. Add seats before inviting more people.",
        "errors.BILLING_STORAGE_QUOTA_EXCEEDED":
            "The storage of your plan ({{quotaGb}} GB) is full. Delete some files or upgrade your plan.",
        "billing.bankEventBody": "{{bank}} credit: {{content}}",
        "billing.manualBank": "Manual",
        "billing.manualEvidenceLog": "Manual evidence of {{amount}} VND dated {{date}}",
    },
}
