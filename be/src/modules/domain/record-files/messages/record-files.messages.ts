import type { MessageBundle } from "@modules/platform/i18n"

/** Localized copy for the record files errors. */
export const RECORD_FILES_MESSAGES: MessageBundle = {
    vi: {
        "errors.RECORD_FILES_TYPE_UNKNOWN": "Không có loại dữ liệu này.",
        "errors.RECORD_FILES_FIELD_NOT_FILE": "Trường này không nhận tệp.",
        "errors.RECORD_FILES_RECORD_NOT_FOUND": "Không tìm thấy bản ghi trong không gian làm việc này.",
        "errors.RECORD_FILES_MIME_NOT_ACCEPTED": "Trường này không nhận loại tệp này.",
        "errors.RECORD_FILES_SIZE_INVALID": "Tệp trống hoặc lớn hơn mức trường này nhận.",
        "errors.RECORD_FILES_KEY_INVALID": "Tệp này không thuộc lần tải lên của bản ghi này.",
        "errors.RECORD_FILES_UPLOAD_MISSING": "Chưa thấy tệp được tải lên. Hãy tải lại.",
        "errors.RECORD_FILES_NO_FILE": "Bản ghi chưa có tệp ở trường này.",
        "errors.RECORD_FILES_STORE_UNAVAILABLE": "Kho tệp đang không phản hồi. Hãy thử lại sau.",
        "errors.RECORD_FILES_URL_INVALID": "Địa chỉ tệp phải là địa chỉ https công khai.",
        "errors.RECORD_FILES_URL_UNREACHABLE": "Không lấy được tệp từ địa chỉ này.",
        "errors.RECORD_FILES_FETCH_NOT_SERVED": "Hệ thống này chưa lấy được tệp từ địa chỉ ngoài.",
        "errors.RECORD_FILES_LIST_FULL": "Trường này đã đủ số tệp tối đa. Hãy xóa một tệp trước khi thêm.",
        "errors.RECORD_FILES_ITEM_KEY_REQUIRED": "Trường này chứa nhiều tệp: hãy chỉ rõ tệp nào.",
        "errors.RECORD_FILES_RECORD_REJECTED": "Bản ghi không nhận tệp này. Hãy tải lại và thử lại.",
    },
    en: {
        "errors.RECORD_FILES_TYPE_UNKNOWN": "This record type does not exist.",
        "errors.RECORD_FILES_FIELD_NOT_FILE": "This field does not take a file.",
        "errors.RECORD_FILES_RECORD_NOT_FOUND": "The record is not in this workspace.",
        "errors.RECORD_FILES_MIME_NOT_ACCEPTED": "This field does not take this type of file.",
        "errors.RECORD_FILES_SIZE_INVALID": "The file is empty or larger than this field takes.",
        "errors.RECORD_FILES_KEY_INVALID": "This file does not belong to an upload of this record.",
        "errors.RECORD_FILES_UPLOAD_MISSING": "The upload was not found. Upload the file again.",
        "errors.RECORD_FILES_NO_FILE": "The record has no file in this field yet.",
        "errors.RECORD_FILES_STORE_UNAVAILABLE": "The file store is not answering. Try again later.",
        "errors.RECORD_FILES_URL_INVALID": "The file address must be a public https address.",
        "errors.RECORD_FILES_URL_UNREACHABLE": "The file could not be fetched from this address.",
        "errors.RECORD_FILES_FETCH_NOT_SERVED": "This system cannot fetch files from outside addresses.",
        "errors.RECORD_FILES_LIST_FULL": "This field already holds the most files it may. Delete one before adding another.",
        "errors.RECORD_FILES_ITEM_KEY_REQUIRED": "This field holds several files: name which one.",
        "errors.RECORD_FILES_RECORD_REJECTED": "The record did not take this file. Reload and try again.",
    },
}
