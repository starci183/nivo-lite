import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the inbox leads capability codes and of the wake line, Vietnamese and English. */
export const WEBSITE_INTAKE_MESSAGES: MessageBundle = {
    vi: {
        "errors.INBOX_LEADS_AGENT_UNKNOWN": "Agent này không thuộc không gian làm việc.",
        "errors.INBOX_LEADS_SITE_UNKNOWN": "Không tìm thấy website này.",
        "errors.INBOX_LEADS_SITE_OFF": "Website này chưa bật nhận khách.",
        "errors.INBOX_LEADS_SUBMISSION_EMPTY": "Cần ít nhất số điện thoại, email hoặc lời nhắn.",
        "websiteIntake.submissionTag": "Khách mới từ website: {{who}}. Họ viết: {{request}}",
    },
    en: {
        "errors.INBOX_LEADS_AGENT_UNKNOWN": "This agent does not belong to the workspace.",
        "errors.INBOX_LEADS_SITE_UNKNOWN": "This website was not found.",
        "errors.INBOX_LEADS_SITE_OFF": "This website does not take customers yet.",
        "errors.INBOX_LEADS_SUBMISSION_EMPTY": "A phone, an email or a message is needed.",
        "websiteIntake.submissionTag": "New customer from the website: {{who}}. They wrote: {{request}}",
    },
}
