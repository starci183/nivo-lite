import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the brain-lessons codes, Vietnamese and English. */
export const BRAIN_LESSONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_LESSONS_INCOMPLETE": "Một bài học cần có tiêu đề và việc cần làm.",
        "errors.BRAIN_LESSONS_NOT_PROPOSED": "Bài học này không còn chờ quyết định.",
        "errors.BRAIN_LESSONS_NOT_ACTIVE": "Bài học này không còn hiệu lực.",
    },
    en: {
        "errors.BRAIN_LESSONS_INCOMPLETE": "A lesson needs a title and what to do.",
        "errors.BRAIN_LESSONS_NOT_PROPOSED": "This lesson is no longer waiting for a decision.",
        "errors.BRAIN_LESSONS_NOT_ACTIVE": "This lesson is no longer in force.",
    },
}
