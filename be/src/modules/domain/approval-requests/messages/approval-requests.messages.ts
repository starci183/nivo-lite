import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the approval-requests codes and the lines the capability writes into the evidence log, Vietnamese and English. */
export const APPROVAL_REQUESTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.APPROVAL_REQUESTS_NOT_FOUND": "Không tìm thấy yêu cầu duyệt này.",
        "errors.APPROVAL_REQUESTS_NO_RULE": "Việc {{action}} chưa có quy tắc nên chưa biết ai được duyệt.",
        "errors.APPROVAL_REQUESTS_NOT_APPROVABLE":
            "Quy tắc không cho phép làm việc {{action}} ở mức này, nên không có gì để duyệt.",
        "errors.APPROVAL_REQUESTS_AGENT_NOT_COVERED": "Quy tắc của việc {{action}} không áp dụng cho agent này.",
        "errors.APPROVAL_REQUESTS_UNIT_MISMATCH": "Đơn vị của yêu cầu không khớp với đơn vị của quy tắc ({{unit}}).",
        "errors.APPROVAL_REQUESTS_NOT_IN_GROUP": "Bạn không thuộc nhóm được duyệt việc này.",
        "errors.APPROVAL_REQUESTS_NO_GRANT": "Bạn chưa được cấp quyền duyệt việc này.",
        "errors.APPROVAL_REQUESTS_OVER_LIMIT": "Mức này vượt hạn mức duyệt của bạn.",
        "errors.APPROVAL_REQUESTS_MEMBER_INACTIVE": "Tài khoản của bạn đang bị khoá nên không duyệt được.",
        "errors.APPROVAL_REQUESTS_ALREADY_APPROVED": "{{name}} đã duyệt lúc {{time}}.",
        "errors.APPROVAL_REQUESTS_ALREADY_REJECTED": "{{name}} đã từ chối lúc {{time}}.",
        "errors.APPROVAL_REQUESTS_INVALID_AMOUNT": "Mức cần duyệt không hợp lệ: phải là số không âm.",
        "errors.APPROVAL_REQUESTS_EXPIRED": "Yêu cầu đã hết hạn và được chuyển cho người phụ trách agent.",
        "errors.APPROVAL_REQUESTS_ALREADY_DECIDED": "Bạn đã trả lời yêu cầu này rồi.",
        "errors.APPROVAL_REQUESTS_NOT_YOUR_TURN": "Chưa đến lượt bạn: đang chờ {{name}} trả lời trước.",
        "approvals.resolved-approved": "Yêu cầu duyệt {{action}} đã được duyệt.",
        "approvals.resolved-rejected": "Yêu cầu duyệt {{action}} bị từ chối.",
        "approvals.resolved-expired": "Yêu cầu duyệt {{action}} hết hạn, chuyển cho {{owner}}.",
        "approvals.resolved-expired-nobody": "Yêu cầu duyệt {{action}} hết hạn, không có người nhận.",
        "approvals.reminder": "Nhắc lần cuối: yêu cầu duyệt {{action}} đang chờ {{names}}.",
    },
    en: {
        "errors.APPROVAL_REQUESTS_NOT_FOUND": "That approval request no longer exists.",
        "errors.APPROVAL_REQUESTS_NO_RULE": "The action {{action}} has no rule, so nobody is known to approve it.",
        "errors.APPROVAL_REQUESTS_NOT_APPROVABLE":
            "The rule never lets {{action}} run at this amount, so there is nothing to approve.",
        "errors.APPROVAL_REQUESTS_AGENT_NOT_COVERED": "The rule of {{action}} does not apply to this agent.",
        "errors.APPROVAL_REQUESTS_UNIT_MISMATCH":
            "The unit of the request does not match the unit of the rule ({{unit}}).",
        "errors.APPROVAL_REQUESTS_NOT_IN_GROUP": "You are not in the group that approves this.",
        "errors.APPROVAL_REQUESTS_NO_GRANT": "You were not granted the right to approve this.",
        "errors.APPROVAL_REQUESTS_OVER_LIMIT": "This amount is over your approval limit.",
        "errors.APPROVAL_REQUESTS_MEMBER_INACTIVE": "Your account is disabled, so you cannot approve.",
        "errors.APPROVAL_REQUESTS_ALREADY_APPROVED": "{{name}} already approved it at {{time}}.",
        "errors.APPROVAL_REQUESTS_ALREADY_REJECTED": "{{name}} already rejected it at {{time}}.",
        "errors.APPROVAL_REQUESTS_INVALID_AMOUNT":
            "The amount to approve is not valid: it must be a number that is not negative.",
        "errors.APPROVAL_REQUESTS_EXPIRED": "The request ran out of time and went to the owner of the agent.",
        "errors.APPROVAL_REQUESTS_ALREADY_DECIDED": "You already answered this request.",
        "errors.APPROVAL_REQUESTS_NOT_YOUR_TURN": "It is not your turn yet: waiting for {{name}} to answer first.",
        "approvals.resolved-approved": "The approval request for {{action}} was approved.",
        "approvals.resolved-rejected": "The approval request for {{action}} was rejected.",
        "approvals.resolved-expired": "The approval request for {{action}} ran out of time and went to {{owner}}.",
        "approvals.resolved-expired-nobody":
            "The approval request for {{action}} ran out of time and had nobody to go to.",
        "approvals.reminder": "Last reminder: the approval request for {{action}} is waiting for {{names}}.",
    },
}
