import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the workspaces codes, Vietnamese and English. */
export const WORKSPACES_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORKSPACES_SIGNUP_DISABLED":
            "M\u00f4i tr\u01b0\u1eddng n\u00e0y ch\u01b0a cho t\u1ea1o kh\u00f4ng gian l\u00e0m vi\u1ec7c mi\u1ec5n ph\u00ed.",
        "errors.WORKSPACES_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y workspace.",
        "errors.WORKSPACES_NAME_INVALID": "Tên workspace cần từ 1 đến 120 ký tự.",
        "errors.WORKSPACES_DELETE_CONFIRM_MISMATCH": "Tên bạn nhập không khớp với tên workspace.",
        "errors.WORKSPACES_RESTORE_EXPIRED": "Đã quá 30 ngày nên không khôi phục được workspace này nữa.",
        "errors.WORKSPACES_ENTERPRISE_KEY_INVALID":
            "Mã định danh doanh nghiệp chỉ gồm chữ thường, số và dấu gạch nối, tối đa 40 ký tự.",
        "errors.WORKSPACES_ENTERPRISE_KEY_TAKEN": "Mã định danh doanh nghiệp này đã thuộc về một workspace khác.",
        "errors.WORKSPACES_TIME_ZONE_INVALID": "Múi giờ không hợp lệ. Hãy chọn một múi giờ trong danh sách.",
        "errors.WORKSPACES_THEME_INVALID": "Giao diện không hợp lệ. Hãy chọn màu, font và bo góc trong phạm vi cho phép.",
        "errors.WORKSPACES_PLAN_UNKNOWN":
            "G\u00f3i kh\u00f4ng t\u1ed3n t\u1ea1i ho\u1eb7c \u0111\u00e3 ng\u1eebng b\u00e1n.",
        "errors.WORKSPACES_NOTHING_TO_KEEP": "Kh\u00f4ng gi\u1eef workspace n\u00e0o.",
        "errors.WORKSPACES_KEEP_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y workspace c\u1ea7n gi\u1eef.",
        "errors.WORKSPACES_DELETE_FAILED": "Kh\u00f4ng x\u00f3a \u0111\u01b0\u1ee3c m\u1ed9t s\u1ed1 workspace.",
    },
    en: {
        "errors.WORKSPACES_SIGNUP_DISABLED": "Free workspaces cannot be created in this environment.",
        "errors.WORKSPACES_NOT_FOUND": "Workspace not found.",
        "errors.WORKSPACES_NAME_INVALID": "A workspace name takes 1 to 120 characters.",
        "errors.WORKSPACES_DELETE_CONFIRM_MISMATCH": "The name you typed is not the workspace's name.",
        "errors.WORKSPACES_RESTORE_EXPIRED":
            "This workspace was deleted more than 30 days ago and can no longer be restored.",
        "errors.WORKSPACES_ENTERPRISE_KEY_INVALID":
            "An enterprise identifier is lowercase letters, digits and hyphens, at most 40 characters.",
        "errors.WORKSPACES_ENTERPRISE_KEY_TAKEN": "Another workspace already holds this enterprise identifier.",
        "errors.WORKSPACES_TIME_ZONE_INVALID": "This is not a time zone. Choose one from the list.",
        "errors.WORKSPACES_THEME_INVALID": "This theme is not valid. Keep the colour, font and corners within the allowed range.",
        "errors.WORKSPACES_PLAN_UNKNOWN": "Unknown or retired plan.",
        "errors.WORKSPACES_NOTHING_TO_KEEP": "No workspace is kept.",
        "errors.WORKSPACES_KEEP_NOT_FOUND": "A workspace to keep was not found.",
        "errors.WORKSPACES_DELETE_FAILED": "Some workspaces could not be deleted.",
    },
}
