import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the ai-generations codes and the sentence an interactive screen shows when OpenClaw cannot answer. */
export const AI_GENERATIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AI_GENERATIONS_FAILED": "{{message}}",
        "errors.AI_GENERATIONS_NOT_CREATED": "Không ghi được yêu cầu viết văn bản.",
        "errors.AI_GENERATIONS_NOT_FOUND": "Không tìm thấy yêu cầu viết văn bản.",
        "generation.busy": "NIVO đang bận, thử lại sau ít phút.",
    },
    en: {
        "errors.AI_GENERATIONS_FAILED": "{{message}}",
        "errors.AI_GENERATIONS_NOT_CREATED": "The text request could not be written.",
        "errors.AI_GENERATIONS_NOT_FOUND": "The text request was not found.",
        "generation.busy": "NIVO is busy, please try again in a few minutes.",
    },
}
