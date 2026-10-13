import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the flow engine: its error codes and the replies NIVO writes in the owner's Office chat. */
export const FLOW_ENGINE_MESSAGES: MessageBundle = {
    vi: {
        "errors.FLOW_ENGINE_INVALID_PAYLOAD": "Thiếu hoặc sai dữ liệu: {{field}}.",
        "errors.FLOW_ENGINE_MODE_CAPPED": "Thao tác {{action}} luôn cần người duyệt, không thể để tự động.",
        "flowEngine.forbidden": "Bạn không có quyền thực hiện thao tác này. Hãy nhờ chủ sở hữu hoặc quản lý.",
        "flowEngine.authoritySaved": "Đã lưu quyền bạn giao: {{changes}}",
        "flowEngine.authorityNothing":
            "Tôi chưa thấy quyền nào cần thay đổi. Ví dụ: “@nivo cho Sales tự gửi follow-up, đơn trên 20 triệu thì hỏi tôi, mục tiêu 300 triệu tháng này”.",
        "flowEngine.goalRevenue": "mục tiêu doanh thu {{amount}}",
        "flowEngine.goalCustomers": "mục tiêu {{n}} khách hàng mới",
        "flowEngine.goalReply": "trả lời đầu tiên trong {{n}} phút",
        "flowEngine.policies": "{{n}} dòng chính sách mới",
        "flowEngine.replyStyle": "cách phản hồi",
        "flowEngine.brandVoice": "giọng thương hiệu",
        "flowEngine.limits": "ghi chú “hỏi tôi trước”",
        "flowEngine.rule": "{{dept}} · {{action}}: {{mode}}",
        "flowEngine.ruleLimit": "dưới {{amount}}",
        "flowEngine.mode.auto": "Tự động",
        "flowEngine.mode.ask": "Hỏi trước",
        "flowEngine.mode.never": "Không bao giờ",
        "flowEngine.authorityDecisionNote": "Đổi quyền trong Office chat: {{changes}}",
        "flowEngine.noWaiting": "Hiện không có việc nào chờ bạn quyết định.",
        "flowEngine.decided": "{{decision}}: {{summary}}",
        "flowEngine.approvedWord": "Đã duyệt",
        "flowEngine.rejectedWord": "Đã từ chối",
        "flowEngine.decisionNote": "Quyết định trong Office chat",
        "flowEngine.which":
            "Đang có {{n}} việc chờ, tôi chưa biết bạn muốn {{verb}} việc nào nên chưa thay đổi gì: {{list}}. Hãy ghi rõ tên khách, số tiền hoặc mã đơn, ví dụ: “@nivo {{example}}”.",
        "flowEngine.noMatch":
            "Không có đúng một việc chờ khớp với tin nhắn của bạn nên tôi chưa thay đổi gì. Đang chờ: {{list}}. Hãy ghi rõ tên khách, số tiền hoặc mã đơn, ví dụ: “@nivo {{example}}”.",
        "flowEngine.reconcileNeedsCard":
            "Không thể duyệt đối soát thanh toán bằng tin nhắn: {{item}}. Khoản tiền vào chưa rõ cần duyệt trên thẻ, kèm căn cứ (hóa đơn hoặc đơn khớp). Tôi chưa thay đổi gì.",
        "flowEngine.verbApprove": "duyệt",
        "flowEngine.verbReject": "từ chối",
        "flowEngine.moreWaiting": "và {{n}} việc khác",
    },
    en: {
        "errors.FLOW_ENGINE_INVALID_PAYLOAD": "Missing or invalid input: {{field}}.",
        "errors.FLOW_ENGINE_MODE_CAPPED": "The action {{action}} always needs a person and cannot run alone.",
        "flowEngine.forbidden": "You do not have permission to do this. Ask an owner or manager.",
        "flowEngine.authoritySaved": "Saved your authority: {{changes}}",
        "flowEngine.authorityNothing":
            "I did not find any authority to change. Example: “@nivo let Sales send follow-ups by itself, ask me for orders over 20 million, goal 300 million this month”.",
        "flowEngine.goalRevenue": "revenue goal {{amount}}",
        "flowEngine.goalCustomers": "new-customer goal {{n}}",
        "flowEngine.goalReply": "first reply within {{n}} minutes",
        "flowEngine.policies": "{{n}} new policy line(s)",
        "flowEngine.replyStyle": "reply style",
        "flowEngine.brandVoice": "brand voice",
        "flowEngine.limits": "“ask me first” note",
        "flowEngine.rule": "{{dept}} · {{action}}: {{mode}}",
        "flowEngine.ruleLimit": "below {{amount}}",
        "flowEngine.mode.auto": "Auto",
        "flowEngine.mode.ask": "Ask first",
        "flowEngine.mode.never": "Never",
        "flowEngine.authorityDecisionNote": "Authority changed in Office chat: {{changes}}",
        "flowEngine.noWaiting": "Nothing is waiting for your decision right now.",
        "flowEngine.decided": "{{decision}}: {{summary}}",
        "flowEngine.approvedWord": "Approved",
        "flowEngine.rejectedWord": "Rejected",
        "flowEngine.decisionNote": "Decided in Office chat",
        "flowEngine.which":
            "{{n}} items are waiting and I cannot tell which one you want to {{verb}}, so I changed nothing: {{list}}. Name the customer, amount or order number, for example: “@nivo {{example}}”.",
        "flowEngine.noMatch":
            "No waiting item matches exactly one of your words, so I changed nothing. Waiting: {{list}}. Name the customer, amount or order number, for example: “@nivo {{example}}”.",
        "flowEngine.reconcileNeedsCard":
            "A payment reconciliation cannot be approved by chat: {{item}}. An unclear bank credit needs the approval card with a basis (the matching invoice or order). I changed nothing.",
        "flowEngine.verbApprove": "approve",
        "flowEngine.verbReject": "reject",
        "flowEngine.moreWaiting": "and {{n}} more",
    },
}
