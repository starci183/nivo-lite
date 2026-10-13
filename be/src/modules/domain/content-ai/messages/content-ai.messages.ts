import type { MessageBundle } from "@modules/platform/i18n"

/** Localized outcomes for content generation and planning. */
export const CONTENT_AI_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTENT_AI_INVALID_INPUT": "Dữ liệu nội dung không hợp lệ.",
        "errors.CONTENT_AI_DRAFTING_BLOCKED": "Quyền soạn nội dung đang tắt.",
        "errors.CONTENT_AI_NO_PILLARS": "Hãy thêm chủ đề đang hoạt động trước khi lập kế hoạch.",
        "errors.CONTENT_AI_NO_CADENCE": "Hãy thiết lập lịch đăng trước khi lập kế hoạch.",
        "errors.CONTENT_AI_NO_SLOTS": "Tháng này không còn lịch đăng sắp tới.",
        "errors.CONTENT_AI_INVALID_ANSWER": "Không đọc được nội dung AI trả về.",
        "errors.CONTENT_AI_EMPTY_ANSWER": "AI chưa tạo được nội dung cho yêu cầu này.",
        "errors.CONTENT_AI_NOT_FOUND": "Không tìm thấy yêu cầu nội dung.",
        "errors.CONTENT_AI_FAILED": "Không hoàn thành được yêu cầu nội dung.",
    },
    en: {
        "errors.CONTENT_AI_INVALID_INPUT": "The content input is invalid.",
        "errors.CONTENT_AI_DRAFTING_BLOCKED": "Content drafting authority is switched off.",
        "errors.CONTENT_AI_NO_PILLARS": "Add an active content theme before planning.",
        "errors.CONTENT_AI_NO_CADENCE": "Set a posting cadence before planning.",
        "errors.CONTENT_AI_NO_SLOTS": "There are no upcoming posting slots in this month.",
        "errors.CONTENT_AI_INVALID_ANSWER": "The AI answer could not be read.",
        "errors.CONTENT_AI_EMPTY_ANSWER": "The AI did not produce content for this request.",
        "errors.CONTENT_AI_NOT_FOUND": "The content request was not found.",
        "errors.CONTENT_AI_FAILED": "The content request could not be completed.",
    },
}
