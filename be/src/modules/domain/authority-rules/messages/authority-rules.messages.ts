import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the authority-rules codes, Vietnamese and English. */
export const AUTHORITY_RULES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AUTHORITY_RULES_UNKNOWN_ACTION": "Hành động {{action}} không có trong danh mục.",
        "errors.AUTHORITY_RULES_INVALID_UNIT": "Đơn vị {{unit}} không hợp lệ. Chọn đ, % hoặc số lượng.",
        "errors.AUTHORITY_RULES_INVALID_BANDS":
            "Các mức không hợp lệ: mức tự động phải nhỏ hơn hoặc bằng mức hỏi trước, không âm, tối đa 100 với phần trăm và là số nguyên với số lượng.",
        "errors.AUTHORITY_RULES_INVALID_POLICY":
            "Luật duyệt {{policy}} không hợp lệ. Chọn 1 người bất kỳ, tất cả hoặc theo thứ tự.",
        "errors.AUTHORITY_RULES_INVALID_TIMEOUT": "Thời hạn duyệt phải từ 1 phút đến 7 ngày.",
        "errors.AUTHORITY_RULES_INVALID_GROUP": "Nhóm duyệt không hợp lệ: vai trò, phòng hoặc người duyệt không đúng.",
        "errors.AUTHORITY_RULES_INVALID_AGENTS": "Danh sách agent áp dụng không hợp lệ.",
    },
    en: {
        "errors.AUTHORITY_RULES_UNKNOWN_ACTION": "The action {{action}} is not in the registry.",
        "errors.AUTHORITY_RULES_INVALID_UNIT": "The unit {{unit}} is not valid. Choose VND, percent or count.",
        "errors.AUTHORITY_RULES_INVALID_BANDS":
            "The bands are not valid: the auto band must not exceed the ask band, none may be negative, a percentage stays within 100 and a count is a whole number.",
        "errors.AUTHORITY_RULES_INVALID_POLICY":
            "The approval rule {{policy}} is not valid. Choose any one, all or in order.",
        "errors.AUTHORITY_RULES_INVALID_TIMEOUT": "The time to approve must be between one minute and seven days.",
        "errors.AUTHORITY_RULES_INVALID_GROUP": "The approver group is not valid: check its roles, rooms and members.",
        "errors.AUTHORITY_RULES_INVALID_AGENTS": "The list of agents the rule applies to is not valid.",
    },
}
