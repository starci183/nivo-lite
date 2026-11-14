import type { MessageBundle } from "@modules/platform/i18n"
import type { ContradictionParts } from "../lesson-candidates.contracts"

/** Display text of the brain-lessons codes, Vietnamese and English. */
export const BRAIN_LESSONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_LESSONS_INCOMPLETE": "Một bài học cần có tiêu đề và việc cần làm.",
        "errors.BRAIN_LESSONS_NOT_PROPOSED": "Bài học này không còn chờ quyết định.",
        "errors.BRAIN_LESSONS_NOT_ACTIVE": "Bài học này không còn hiệu lực.",
        "errors.BRAIN_LESSONS_CANDIDATE_LOST": "Không đọc lại được câu trả lời vừa ghi nhận để học.",
    },
    en: {
        "errors.BRAIN_LESSONS_INCOMPLETE": "A lesson needs a title and what to do.",
        "errors.BRAIN_LESSONS_NOT_PROPOSED": "This lesson is no longer waiting for a decision.",
        "errors.BRAIN_LESSONS_NOT_ACTIVE": "This lesson is no longer in force.",
        "errors.BRAIN_LESSONS_CANDIDATE_LOST": "The answer just kept for learning could not be read back.",
    },
}

/** The reason line of a lesson card (Vietnamese, as the founder reads it; written by the engine, never by the model). */
export const LESSON_REASON_COPY = {
    /** A truth the founder answered the same way again and again: what was asked, what they said, the proposal. */
    learned: (asked: number, topic: string, quotes: string): string =>
        `Đã hỏi chủ tiệm ${asked} lần về ${topic}; chủ tiệm trả lời: ${quotes}; đề nghị ghi thành quy định để lần sau tự xử lý.`,
    /** A question card: the answers of the group disagree; the newest is put forward and the founder chooses. */
    contradiction: (parts: ContradictionParts): string =>
        `Đã hỏi chủ tiệm ${parts.asked} lần về ${parts.topic}, nhưng hai câu trả lời khác nhau: ${parts.older} (${parts.olderDay}) và ` +
        `${parts.newer} (${parts.newerDay}). Chủ tiệm muốn ghi quy định nào? Đồng ý = ghi theo câu mới nhất; Không = vẫn hỏi từng lần.`,
} as const
