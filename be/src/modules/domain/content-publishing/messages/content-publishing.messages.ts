import type { MessageBundle } from "@modules/platform/i18n"

/** Publishing errors and durable history text, in the caller's language. */
export const CONTENT_PUBLISHING_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTENT_PUBLISHING_NOT_DRAFTED": "Hãy soạn bài trước khi gửi duyệt.",
        "errors.CONTENT_PUBLISHING_WRONG_STATUS": "Trạng thái bài đăng không cho phép thao tác này.",
        "errors.CONTENT_PUBLISHING_TEXT_MISSING": "Mỗi kênh cần có nội dung bài đăng.",
        "errors.CONTENT_PUBLISHING_GATE_FAILED": "Không gửi được bài vào hàng chờ duyệt.",
        "errors.CONTENT_PUBLISHING_CHANNEL_INVALID": "Kênh đăng không thuộc bài này.",
        "errors.CONTENT_PUBLISHING_URL_INVALID": "Đường dẫn bài đăng phải dùng HTTP hoặc HTTPS.",
        "contentPublishing.summary": "Duyệt bài {{title}} để đăng trên {{channels}}.",
        "contentPublishing.submitted": "{{who}} gửi bài để duyệt, quyết định {{id}}.",
        "contentPublishing.approved": "{{who}} duyệt bài, quyết định {{id}}.",
        "contentPublishing.rejected": "{{who}} từ chối duyệt; bài trở về bản nháp.",
        "contentPublishing.failed": "Không gửi được bài để duyệt; bài trở về bản nháp.",
        "contentPublishing.defaultHow": "Đăng thủ công",
        "contentPublishing.published": "{{who}} đăng bài trên {{channel}}: {{proof}}.",
        "contentPublishing.event": "Đã đăng {{title}} trên {{channel}}.",
    },
    en: {
        "errors.CONTENT_PUBLISHING_NOT_DRAFTED": "Draft the post before submitting it for approval.",
        "errors.CONTENT_PUBLISHING_WRONG_STATUS": "The post's status does not allow this action.",
        "errors.CONTENT_PUBLISHING_TEXT_MISSING": "Every selected channel needs post text.",
        "errors.CONTENT_PUBLISHING_GATE_FAILED": "The post could not be submitted for approval.",
        "errors.CONTENT_PUBLISHING_CHANNEL_INVALID": "This post does not include that channel.",
        "errors.CONTENT_PUBLISHING_URL_INVALID": "The post URL must use HTTP or HTTPS.",
        "contentPublishing.summary": "Approve {{title}} for posting on {{channels}}.",
        "contentPublishing.submitted": "{{who}} submitted the post for approval, decision {{id}}.",
        "contentPublishing.approved": "{{who}} approved the post, decision {{id}}.",
        "contentPublishing.rejected": "{{who}} rejected the post; it returned to draft.",
        "contentPublishing.failed": "Submission for approval failed; the post returned to draft.",
        "contentPublishing.defaultHow": "Posted manually",
        "contentPublishing.published": "{{who}} posted on {{channel}}: {{proof}}.",
        "contentPublishing.event": "Posted {{title}} on {{channel}}.",
    },
}
