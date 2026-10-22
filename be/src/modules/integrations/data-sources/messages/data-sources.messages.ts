import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the data-sources codes, Vietnamese and English. */
export const DATA_SOURCES_MESSAGES: MessageBundle = {
    vi: {
        "errors.DATA_SOURCES_HOST_INVALID": "Địa chỉ máy chủ không hợp lệ.",
        "errors.DATA_SOURCES_HOST_UNKNOWN": "Không tìm thấy máy chủ {{host}}.",
        "errors.DATA_SOURCES_HOST_PRIVATE": "{{host}} trỏ vào mạng nội bộ; NIVO chỉ kết nối tới địa chỉ công khai.",
        "errors.DATA_SOURCES_TOO_LARGE": "Dữ liệu quá lớn (hơn {{limit}}).",
        "errors.DATA_SOURCES_REJECTED": "{{detail}}",
        "errors.DATA_SOURCES_UNAVAILABLE": "{{detail}}",
    },
    en: {
        "errors.DATA_SOURCES_HOST_INVALID": "The server address is not valid.",
        "errors.DATA_SOURCES_HOST_UNKNOWN": "The server {{host}} was not found.",
        "errors.DATA_SOURCES_HOST_PRIVATE":
            "{{host}} points into a private network; NIVO only connects to public addresses.",
        "errors.DATA_SOURCES_TOO_LARGE": "The data is too large (over {{limit}}).",
        "errors.DATA_SOURCES_REJECTED": "{{detail}}",
        "errors.DATA_SOURCES_UNAVAILABLE": "{{detail}}",
    },
}
