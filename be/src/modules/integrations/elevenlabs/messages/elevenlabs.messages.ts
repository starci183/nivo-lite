import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the ElevenLabs codes, Vietnamese and English. */
export const ELEVENLABS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ELEVENLABS_UNREACHABLE": "Không liên lạc được ElevenLabs.",
        "errors.ELEVENLABS_AUTH_FAILED": "ElevenLabs không chấp nhận API key của kết nối.",
        "errors.ELEVENLABS_RATE_LIMITED": "ElevenLabs yêu cầu chậm lại, thử lại sau.",
        "errors.ELEVENLABS_NOT_FOUND": "ElevenLabs không tìm thấy thứ được hỏi.",
        "errors.ELEVENLABS_REJECTED": "ElevenLabs từ chối yêu cầu.",
        "errors.ELEVENLABS_FAILED": "ElevenLabs gặp lỗi khi xử lý.",
        "errors.ELEVENLABS_MALFORMED": "ElevenLabs trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.ELEVENLABS_UNREACHABLE": "ElevenLabs could not be reached.",
        "errors.ELEVENLABS_AUTH_FAILED": "ElevenLabs did not accept the API key of the connection.",
        "errors.ELEVENLABS_RATE_LIMITED": "ElevenLabs asked to slow down; try again later.",
        "errors.ELEVENLABS_NOT_FOUND": "ElevenLabs did not find what was asked.",
        "errors.ELEVENLABS_REJECTED": "ElevenLabs refused the request.",
        "errors.ELEVENLABS_FAILED": "ElevenLabs failed while processing.",
        "errors.ELEVENLABS_MALFORMED": "ElevenLabs answered something unreadable.",
    },
}
