import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the inbox-leads codes, Vietnamese and English. */
export const INBOX_LEADS_MESSAGES: MessageBundle = {
    vi: {
        "errors.INBOX_LEADS_LEAD_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "errors.INBOX_LEADS_AGENT_UNKNOWN": "Agent này không thuộc không gian làm việc.",
        "errors.INBOX_LEADS_WRITE_REFUSED": "Không ghi được: khách vừa đổi hoặc vi phạm một quy tắc.",
        "errors.INBOX_LEADS_FORBIDDEN": "Chỉ chủ sở hữu hoặc quản lý được đổi cách nhận khách từ website.",
        "errors.INBOX_LEADS_SITE_UNKNOWN": "Không tìm thấy website này.",
        "errors.INBOX_LEADS_SITE_OFF": "Website này chưa bật nhận khách.",
        "errors.INBOX_LEADS_SUBMISSION_EMPTY": "Cần ít nhất số điện thoại, email hoặc lời nhắn.",
        "inboxLeads.websiteLeadTag": "Khách mới từ website: {{who}}. Họ viết: {{request}}",
    },
    en: {
        "errors.INBOX_LEADS_LEAD_NOT_FOUND": "This customer was not found.",
        "errors.INBOX_LEADS_AGENT_UNKNOWN": "This agent does not belong to the workspace.",
        "errors.INBOX_LEADS_WRITE_REFUSED": "The write was refused: the customer just changed or broke a rule.",
        "errors.INBOX_LEADS_FORBIDDEN": "Only an owner or a manager may change how the website brings in customers.",
        "errors.INBOX_LEADS_SITE_UNKNOWN": "This website was not found.",
        "errors.INBOX_LEADS_SITE_OFF": "This website does not take customers yet.",
        "errors.INBOX_LEADS_SUBMISSION_EMPTY": "A phone, an email or a message is needed.",
        "inboxLeads.websiteLeadTag": "New customer from the website: {{who}}. They wrote: {{request}}",
    },
}
