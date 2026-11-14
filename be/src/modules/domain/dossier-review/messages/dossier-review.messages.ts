import type { MessageBundle } from "@modules/platform/i18n"
import { DOCUMENT_CRITIC_MESSAGES } from "./document-critic.messages"

/** Display text of the critic codes and of the critic's own lines; Vietnamese and English. */
export const DOSSIER_REVIEW_MESSAGES: MessageBundle = {
    vi: {
        ...DOCUMENT_CRITIC_MESSAGES.vi,
        "errors.DOSSIER_REVIEW_CRITIC_NOT_FOUND": "Không tìm thấy điểm soát hoặc tài liệu này.",
        "errors.DOSSIER_REVIEW_CRITIC_DECIDED": "Điểm này đã được trả lời, bỏ qua, hoặc không còn trong tài liệu.",
        "errors.DOSSIER_REVIEW_CRITIC_ANSWER_INVALID": "Lựa chọn này không có trong điểm soát, hoặc cần điền giá trị.",
        "errors.DOSSIER_REVIEW_CRITIC_RUNNING": "NIVO đang soát tài liệu này. Thử lại khi soát xong.",
    },
    en: {
        ...DOCUMENT_CRITIC_MESSAGES.en,
        "errors.DOSSIER_REVIEW_CRITIC_NOT_FOUND": "This critique point or document does not exist in the workspace.",
        "errors.DOSSIER_REVIEW_CRITIC_DECIDED": "This point was already answered, skipped, or is no longer in the document.",
        "errors.DOSSIER_REVIEW_CRITIC_ANSWER_INVALID": "This answer is not one the point offers, or it needs a value.",
        "errors.DOSSIER_REVIEW_CRITIC_RUNNING": "NIVO is reviewing this document. Try again when it is done.",
    },
}
