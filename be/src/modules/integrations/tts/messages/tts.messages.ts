import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the text-to-speech codes, Vietnamese and English. */
export const TTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.TTS_DISABLED": "Giọng đọc chưa được bật, video chỉ có phụ đề.",
        "errors.TTS_RETRYABLE": "Dịch vụ giọng đọc đang bận, sẽ thử lại.",
        "errors.TTS_ABORTED": "Đã dừng tạo giọng đọc.",
    },
    en: {
        "errors.TTS_DISABLED": "The voiceover is switched off, the video has captions only.",
        "errors.TTS_RETRYABLE": "The voiceover service is busy, it will be tried again.",
        "errors.TTS_ABORTED": "The voiceover was stopped.",
    },
}
