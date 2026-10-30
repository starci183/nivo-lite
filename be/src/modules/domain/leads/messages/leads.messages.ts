import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the leads codes and the lines the capability writes into the evidence log, Vietnamese and English. */
export const LEADS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LEADS_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "errors.LEADS_COMMENT_NOT_ALLOWED": "Bạn không có quyền quyết định bình luận này.",
        "errors.LEADS_COMMENT_NOT_WAITING": "Bình luận này không còn chờ quyết định.",
        "errors.LEADS_COMMENT_FAILED": "Không thể trả lời bình luận này.",
        "leads.stage.new": "mới",
        "leads.stage.qualified": "đủ điều kiện",
        "leads.stage.proposal": "đề xuất",
        "leads.stage.won": "chốt được",
        "leads.stage.lost": "không chốt",
        "leads.stage-event": "Giai đoạn → {{stage}}",
        "leads.stage-message": "{{name}} chuyển sang {{stage}}.",
    },
    en: {
        "errors.LEADS_NOT_FOUND": "That lead no longer exists.",
        "errors.LEADS_COMMENT_NOT_ALLOWED": "You may not decide this comment.",
        "errors.LEADS_COMMENT_NOT_WAITING": "This comment is no longer waiting for a decision.",
        "errors.LEADS_COMMENT_FAILED": "This comment could not be answered.",
        "leads.stage.new": "new",
        "leads.stage.qualified": "qualified",
        "leads.stage.proposal": "proposal",
        "leads.stage.won": "won",
        "leads.stage.lost": "lost",
        "leads.stage-event": "Stage → {{stage}}",
        "leads.stage-message": "{{name}} moved to {{stage}}.",
    },
}
