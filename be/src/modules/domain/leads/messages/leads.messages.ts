import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the leads codes and the lines the capability writes into the evidence log, Vietnamese and English. */
export const LEADS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LEADS_NOT_FOUND": "Không tìm thấy khách hàng này.",
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
        "leads.stage.new": "new",
        "leads.stage.qualified": "qualified",
        "leads.stage.proposal": "proposal",
        "leads.stage.won": "won",
        "leads.stage.lost": "lost",
        "leads.stage-event": "Stage → {{stage}}",
        "leads.stage-message": "{{name}} moved to {{stage}}.",
    },
}
