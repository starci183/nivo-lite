import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the document-readers codes, Vietnamese and English. */
export const DOCUMENT_READERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.DOCUMENT_READERS_LIBRARY_MISSING": "Thư viện đọc loại tệp này chưa được cài trên máy chủ.",
        "errors.DOCUMENT_READERS_CONVERSION_EMPTY": "Bộ giải mã ảnh không trả về dữ liệu.",
        "errors.DOCUMENT_READERS_NOT_WORKBOOK": "Tệp này không phải bảng tính.",
        "errors.DOCUMENT_READERS_NOT_PRESENTATION": "Tệp này không phải bản trình chiếu.",
    },
    en: {
        "errors.DOCUMENT_READERS_LIBRARY_MISSING": "The library that reads this kind of file is not installed on the server.",
        "errors.DOCUMENT_READERS_CONVERSION_EMPTY": "The image decoder returned no data.",
        "errors.DOCUMENT_READERS_NOT_WORKBOOK": "This file is not a workbook.",
        "errors.DOCUMENT_READERS_NOT_PRESENTATION": "This file is not a presentation.",
    },
}
