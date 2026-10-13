import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the knowledge-sources codes, Vietnamese and English. */
export const KNOWLEDGE_SOURCES_MESSAGES: MessageBundle = {
    vi: {
        "errors.KNOWLEDGE_SOURCES_NOT_FOUND": "Không tìm thấy nguồn tri thức này.",
        "errors.KNOWLEDGE_SOURCES_KIND_UNKNOWN": "Loại nguồn tri thức không hợp lệ.",
        "errors.KNOWLEDGE_SOURCES_TITLE_REQUIRED": "Cần đặt tên cho nguồn tri thức.",
        "errors.KNOWLEDGE_SOURCES_CONTENT_EMPTY": "Nội dung đang trống.",
        "errors.KNOWLEDGE_SOURCES_CONTENT_TOO_LONG": "Nội dung dài quá {{max}} ký tự. Hãy tách thành nhiều nguồn.",
        "errors.KNOWLEDGE_SOURCES_URL_INVALID": "Liên kết phải bắt đầu bằng http:// hoặc https://.",
        "errors.KNOWLEDGE_SOURCES_STORAGE_PATH_INVALID": "Đường dẫn tệp không thuộc workspace này.",
        "errors.KNOWLEDGE_SOURCES_INSTANCE_UNKNOWN": "Không tìm thấy agent này trong workspace.",
        "errors.KNOWLEDGE_SOURCES_UPLOAD_UNAVAILABLE": "Chưa tạo được địa chỉ tải lên. Hãy thử lại sau.",
        "errors.KNOWLEDGE_SOURCES_FILE_NAME_REQUIRED": "Cần có tên tệp.",
    },
    en: {
        "errors.KNOWLEDGE_SOURCES_NOT_FOUND": "This knowledge source was not found.",
        "errors.KNOWLEDGE_SOURCES_KIND_UNKNOWN": "The knowledge source kind is not valid.",
        "errors.KNOWLEDGE_SOURCES_TITLE_REQUIRED": "A knowledge source needs a title.",
        "errors.KNOWLEDGE_SOURCES_CONTENT_EMPTY": "The content is empty.",
        "errors.KNOWLEDGE_SOURCES_CONTENT_TOO_LONG":
            "The content is longer than {{max}} characters. Split it into several sources.",
        "errors.KNOWLEDGE_SOURCES_URL_INVALID": "The link must start with http:// or https://.",
        "errors.KNOWLEDGE_SOURCES_STORAGE_PATH_INVALID": "The file path does not belong to this workspace.",
        "errors.KNOWLEDGE_SOURCES_INSTANCE_UNKNOWN": "This agent was not found in the workspace.",
        "errors.KNOWLEDGE_SOURCES_UPLOAD_UNAVAILABLE": "An upload address could not be made. Try again later.",
        "errors.KNOWLEDGE_SOURCES_FILE_NAME_REQUIRED": "A file name is required.",
    },
}
