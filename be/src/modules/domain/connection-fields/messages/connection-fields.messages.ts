import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the connection form codes, Vietnamese and English. */
export const CONNECTION_FIELDS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONNECTION_FIELDS_NOT_WRITABLE": "Kết nối này chưa sửa được ở đây. Hãy dùng bước thiết lập của nó.",
        "errors.CONNECTION_FIELDS_FORBIDDEN": "Bạn không có quyền sửa kết nối này.",
        "errors.CONNECTION_FIELDS_FIELD_UNKNOWN": "Trường {{key}} không có ở kết nối này.",
        "errors.CONNECTION_FIELDS_FIELD_READ_ONLY": "Trường {{key}} chỉ để xem.",
        "errors.CONNECTION_FIELDS_FIELD_REQUIRED": "Trường {{key}} không được để trống.",
        "errors.CONNECTION_FIELDS_FIELD_INVALID": "Giá trị của trường {{key}} không hợp lệ.",
        "errors.CONNECTION_FIELDS_NAME_INVALID": "Tên hiển thị không hợp lệ.",
        "errors.CONNECTION_FIELDS_ACTION_UNKNOWN": "Kết nối này không có thao tác {{action}}.",
        "errors.CONNECTION_FIELDS_DECLARATION_INVALID": "Biểu mẫu kết nối của {{provider}} đang tạm tắt vì khai báo của nó có thể làm lộ khoá bí mật.",
    },
    en: {
        "errors.CONNECTION_FIELDS_NOT_WRITABLE": "This connection cannot be edited here yet. Use its setup steps.",
        "errors.CONNECTION_FIELDS_FORBIDDEN": "You may not edit this connection.",
        "errors.CONNECTION_FIELDS_FIELD_UNKNOWN": "This connection has no field {{key}}.",
        "errors.CONNECTION_FIELDS_FIELD_READ_ONLY": "The field {{key}} can only be viewed.",
        "errors.CONNECTION_FIELDS_FIELD_REQUIRED": "The field {{key}} may not be empty.",
        "errors.CONNECTION_FIELDS_FIELD_INVALID": "The value of {{key}} is not valid.",
        "errors.CONNECTION_FIELDS_NAME_INVALID": "The display name is not valid.",
        "errors.CONNECTION_FIELDS_ACTION_UNKNOWN": "This connection has no action {{action}}.",
        "errors.CONNECTION_FIELDS_DECLARATION_INVALID": "The connection form of {{provider}} is turned off: its declaration could reveal a secret.",
    },
}
