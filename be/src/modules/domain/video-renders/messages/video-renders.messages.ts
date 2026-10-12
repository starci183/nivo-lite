import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the video-renders codes, Vietnamese and English. */
export const VIDEO_RENDERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.VIDEO_RENDERS_NOT_WRITTEN": "Không lưu được lượt dựng video.",
        "errors.VIDEO_RENDERS_TOO_MANY": "Đang có nhiều video đang dựng, chờ một video xong rồi dựng tiếp nhé.",
    },
    en: {
        "errors.VIDEO_RENDERS_NOT_WRITTEN": "The render was not saved.",
        "errors.VIDEO_RENDERS_TOO_MANY": "Several videos are rendering, wait for one to finish.",
    },
}
