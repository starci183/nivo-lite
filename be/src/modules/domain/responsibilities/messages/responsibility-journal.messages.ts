import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the responsibilities codes and the texts the capability writes into the workspace. */
export const RESPONSIBILITY_JOURNAL_MESSAGES: MessageBundle = {
    vi: {
        "errors.RESPONSIBILITIES_NOT_FOUND": "Không tìm thấy mục này trong không gian làm việc.",
        "responsibility.title": "Theo dõi {{name}}",
        "responsibility.next": "Phân loại nhu cầu và liên hệ lại khách",
    },
    en: {
        "errors.RESPONSIBILITIES_NOT_FOUND": "This item was not found in the workspace.",
        "responsibility.title": "Follow up with {{name}}",
        "responsibility.next": "Classify the need and get back to the customer",
    },
}
