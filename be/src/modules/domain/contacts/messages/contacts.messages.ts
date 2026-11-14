import type { MessageBundle } from "@modules/platform/i18n"

/** The words of the contacts: what a person's screen is told when a change is refused. */
export const CONTACTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTACTS_CONTACT_MISSING": "Không tìm thấy người liên hệ này.",
        "errors.CONTACTS_IDENTITY_MISSING": "Người liên hệ không có cách liên lạc này.",
        "errors.CONTACTS_IDENTITY_INVALID": "Số điện thoại hoặc email không hợp lệ.",
        "errors.CONTACTS_IDENTITY_TAKEN": "Cách liên lạc này đã thuộc một người liên hệ khác. Hãy gộp hai người nếu là cùng một người.",
        "errors.CONTACTS_SAME_CONTACT": "Không thể gộp một người liên hệ với chính họ.",
        "errors.CONTACTS_RECORDS_BLOCKED": "Chưa xoá được: một bản ghi của người liên hệ này vẫn đang được bản ghi khác dùng tới.",
    },
    en: {
        "errors.CONTACTS_CONTACT_MISSING": "This contact was not found.",
        "errors.CONTACTS_IDENTITY_MISSING": "The contact holds no such identity.",
        "errors.CONTACTS_IDENTITY_INVALID": "The phone or mail address is not valid.",
        "errors.CONTACTS_IDENTITY_TAKEN": "This identity belongs to another contact. Merge the two if they are one person.",
        "errors.CONTACTS_SAME_CONTACT": "A contact cannot be merged with itself.",
        "errors.CONTACTS_RECORDS_BLOCKED": "Not erased: a record of this contact is still referenced by another record.",
    },
}
