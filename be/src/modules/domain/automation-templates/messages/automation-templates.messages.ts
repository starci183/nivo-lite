import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the automation templates codes, Vietnamese and English. */
export const AUTOMATION_TEMPLATES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AUTOMATION_TEMPLATES_DEFINITION_INVALID": "Mẫu tự động hoá {{key}} không hợp lệ ở mục {{field}}.",
        "errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN": "Không có mẫu tự động hoá này.",
    },
    en: {
        "errors.AUTOMATION_TEMPLATES_DEFINITION_INVALID": "The automation template {{key}} is invalid at {{field}}.",
        "errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN": "There is no such automation template.",
    },
}
