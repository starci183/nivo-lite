import type { MessageBundle } from "@modules/platform/i18n"

/** Localized copy for the avatars errors. */
export const AVATARS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AVATARS_FILE_INVALID": "Ảnh đại diện phải là PNG, JPEG hoặc WebP, tối đa 2 MB.",
        "errors.AVATARS_PATH_INVALID": "Tệp ảnh này không thuộc lần tải lên của bạn.",
        "errors.AVATARS_ADDRESS_INSECURE": "Kho ảnh chưa phục vụ qua HTTPS nên chưa lưu được ảnh đại diện.",
        "errors.AVATARS_UNAVAILABLE": "Chưa lưu được ảnh đại diện. Hãy thử lại sau.",
    },
    en: {
        "errors.AVATARS_FILE_INVALID": "Use a PNG, JPEG or WebP picture of at most 2 MB.",
        "errors.AVATARS_PATH_INVALID": "This picture does not belong to your upload.",
        "errors.AVATARS_ADDRESS_INSECURE": "The picture store does not serve HTTPS yet, so the picture cannot be kept.",
        "errors.AVATARS_UNAVAILABLE": "The picture could not be saved. Try again later.",
    },
}
