import type { MessageBundle } from "@modules/platform/i18n"

/** Localized copy for content-media errors. */
export const CONTENT_MEDIA_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTENT_MEDIA_UPLOAD_INVALID": "Tệp phải là ảnh JPEG, PNG, WebP hoặc video MP4, tối đa 10 MB.",
        "errors.CONTENT_MEDIA_PATH_INVALID": "Đường dẫn tệp không thuộc workspace này.",
        "errors.CONTENT_MEDIA_STORAGE_UNAVAILABLE": "Chưa truy cập được kho tệp. Hãy thử lại sau.",
    },
    en: {
        "errors.CONTENT_MEDIA_UPLOAD_INVALID": "Use a JPEG, PNG, WebP image or MP4 video of at most 10 MB.",
        "errors.CONTENT_MEDIA_PATH_INVALID": "The file path does not belong to this workspace.",
        "errors.CONTENT_MEDIA_STORAGE_UNAVAILABLE": "The file store is unavailable. Try again later.",
    },
}
