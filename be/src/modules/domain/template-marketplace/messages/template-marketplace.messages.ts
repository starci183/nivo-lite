import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the template-marketplace codes, Vietnamese and English. */
export const TEMPLATE_MARKETPLACE_MESSAGES: MessageBundle = {
    vi: {
        "errors.TEMPLATE_MARKETPLACE_LISTING_NOT_FOUND": "Không tìm thấy mẫu trên chợ.",
        "errors.TEMPLATE_MARKETPLACE_NOT_YOURS": "Mẫu này của tài khoản khác.",
        "errors.TEMPLATE_MARKETPLACE_BAD_TRANSITION": "Mẫu đang ở trạng thái không cho bước này.",
        "errors.TEMPLATE_MARKETPLACE_CHECKS_FAILED": "Còn bước kiểm tra tự động chưa đạt nên chưa duyệt được.",
        "errors.TEMPLATE_MARKETPLACE_CONSENT_MISSING":
            "Persona theo người thật cần giấy đồng ý còn hiệu lực của chính người đó.",
        "errors.TEMPLATE_MARKETPLACE_NOT_AVAILABLE": "Mẫu này chưa được duyệt nên chưa dùng được.",
        "errors.TEMPLATE_MARKETPLACE_PAYMENT_REQUIRED": "Mẫu này có phí, hãy thanh toán trước khi cài.",
        "errors.TEMPLATE_MARKETPLACE_NOTHING_TO_PAY": "Mẫu này miễn phí, không cần thanh toán.",
        "errors.TEMPLATE_MARKETPLACE_PRICE_INVALID": "Giá phải là số đồng nguyên, không âm.",
        "errors.TEMPLATE_MARKETPLACE_NOT_A_TEMPLATE_INSTALL": "Agent này không cài từ mẫu.",
        "errors.TEMPLATE_MARKETPLACE_UPDATE_UNAVAILABLE": "Không có bản cập nhật này để áp dụng.",
        "errors.TEMPLATE_MARKETPLACE_GRANT_NOT_FOUND": "Không tìm thấy giấy đồng ý này.",
    },
    en: {
        "errors.TEMPLATE_MARKETPLACE_LISTING_NOT_FOUND": "That listing was not found.",
        "errors.TEMPLATE_MARKETPLACE_NOT_YOURS": "This template belongs to another account.",
        "errors.TEMPLATE_MARKETPLACE_BAD_TRANSITION": "The listing is in a state that does not allow this step.",
        "errors.TEMPLATE_MARKETPLACE_CHECKS_FAILED": "An automated check has not passed, so it cannot be approved.",
        "errors.TEMPLATE_MARKETPLACE_CONSENT_MISSING": "A persona of a real person needs that person's valid consent.",
        "errors.TEMPLATE_MARKETPLACE_NOT_AVAILABLE": "This listing is not approved yet, so it cannot be used.",
        "errors.TEMPLATE_MARKETPLACE_PAYMENT_REQUIRED": "This listing has a price. Pay for it before installing.",
        "errors.TEMPLATE_MARKETPLACE_NOTHING_TO_PAY": "This listing is free; there is nothing to pay.",
        "errors.TEMPLATE_MARKETPLACE_PRICE_INVALID": "The price must be a whole, non-negative amount of dong.",
        "errors.TEMPLATE_MARKETPLACE_NOT_A_TEMPLATE_INSTALL": "This agent was not installed from a template.",
        "errors.TEMPLATE_MARKETPLACE_UPDATE_UNAVAILABLE": "That update is not available to apply.",
        "errors.TEMPLATE_MARKETPLACE_GRANT_NOT_FOUND": "That consent record was not found.",
    },
}
