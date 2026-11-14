import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the account-data codes, Vietnamese and English. */
export const ACCOUNT_DATA_MESSAGES: MessageBundle = {
    vi: {
        "errors.ACCOUNT_DATA_TYPE_UNDECLARED": "Loại dữ liệu này chưa được khai báo cho tài khoản này.",
        "errors.ACCOUNT_DATA_TYPE_INVALID": "Khai báo loại dữ liệu không hợp lệ.",
        "errors.ACCOUNT_DATA_VALUE_INVALID": "Dữ liệu không đúng với khai báo của loại.",
        "errors.ACCOUNT_DATA_SECRET_IN_VALUE": "Dữ liệu chứa thông tin bí mật nên không được lưu.",
        "errors.ACCOUNT_DATA_VALUE_TOO_LARGE": "Dữ liệu quá lớn để lưu.",
        "errors.ACCOUNT_DATA_WRITE_MODE": "Loại dữ liệu này không được ghi theo cách này.",
        "errors.ACCOUNT_DATA_INDEX_UNDECLARED": "Trường này không có chỉ mục được khai báo.",
    },
    en: {
        "errors.ACCOUNT_DATA_TYPE_UNDECLARED": "This data type is not declared for this account.",
        "errors.ACCOUNT_DATA_TYPE_INVALID": "This data type declaration is not valid.",
        "errors.ACCOUNT_DATA_VALUE_INVALID": "The data does not fit its type's declaration.",
        "errors.ACCOUNT_DATA_SECRET_IN_VALUE": "The data holds a secret, so it was not stored.",
        "errors.ACCOUNT_DATA_VALUE_TOO_LARGE": "The data is too large to store.",
        "errors.ACCOUNT_DATA_WRITE_MODE": "This data type is not written this way.",
        "errors.ACCOUNT_DATA_INDEX_UNDECLARED": "This member has no declared index.",
    },
}
