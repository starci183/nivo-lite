import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the platform-admin codes, Vietnamese and English. */
export const PLATFORM_ADMIN_MESSAGES: MessageBundle = {
    vi: {
        "errors.PLATFORM_ADMIN_NOT_FOUND": "Không tìm thấy trang này.",
        "errors.PLATFORM_ADMIN_WORKSPACE_NOT_FOUND": "Không tìm thấy workspace.",
        "errors.PLATFORM_ADMIN_PLAN_UNKNOWN": "Gói không tồn tại hoặc đã ngừng bán.",
    },
    en: {
        "errors.PLATFORM_ADMIN_NOT_FOUND": "Page not found.",
        "errors.PLATFORM_ADMIN_WORKSPACE_NOT_FOUND": "Workspace not found.",
        "errors.PLATFORM_ADMIN_PLAN_UNKNOWN": "Unknown or retired plan.",
    },
}
