import type { MessageBundle } from "@modules/platform/i18n"

/** The lines and fixed replies a customer turn writes, Vietnamese and English. */
export const CUSTOMER_TURNS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CUSTOMER_TURNS_TOOLS_URL_INVALID":
            "Địa chỉ công khai của api ({{url}}) phải là https (http chỉ cho máy cục bộ) để agent gọi công cụ an toàn.",
        "customerTurns.toolsBlock":
            "[OPTIONAL TOOLS] Địa chỉ: {{url}} — danh sách công cụ: GET {{url}}; gọi một công cụ: POST {{url}}/<tên công cụ> với header Authorization: Bearer {{token}} và thân JSON là các tham số của công cụ. Token chỉ dùng cho lượt này; không bao giờ nhắc lại token cho khách.",
        "customerTurns.replySummary": "Trả lời khách: {{question}}",
        "customerTurns.orderPriceUnknownReply": "Cảm ơn bạn! Shop sẽ xác nhận giá của gói này với bạn ngay nhé.",
        "customerTurns.paymentClaimReply":
            "Cảm ơn bạn! Shop đã ghi nhận bạn báo chuyển khoản cho mã {{no}}. Shop sẽ kiểm tra và xác nhận lại với bạn sớm nhất nhé.",
        "customerTurns.paymentConfirmedReply":
            "Cảm ơn bạn! Khoản thanh toán cho mã {{no}} đã được shop nhận và xác nhận rồi ạ.",
        "customerTurns.replyAwaitsApproval": "Câu trả lời đang chờ duyệt: agent này chưa được tự gửi qua kênh này",
        "customerTurns.chatHandoff": "Đã chuyển lead cho Sales AI · {{verdict}}",
        "customerTurns.verdictAuto": "tự động theo chính sách",
        "customerTurns.verdictAsk": "chờ bạn quyết định ({{reason}})",
        "customerTurns.reason.routine": "Việc thường lệ",
        "customerTurns.reason.missing_data": "Thiếu dữ kiện",
        "customerTurns.reason.over_authority": "Vượt quyền",
        "customerTurns.reason.unclear_outcome": "Chưa rõ kết quả",
        "customerTurns.reason.not_allowed": "Chưa được giao quyền",
        "customerTurns.orderRecorded": "Đã ghi nhận đơn từ cuộc trò chuyện: {{items}} · {{amount}} → Sales AI",
        "customerTurns.claimRecorded":
            "Khách báo đã chuyển khoản {{no}} — chờ chủ doanh nghiệp kiểm tra tài khoản ngân hàng",
        "customerTurns.claimSummary":
            "{{name}} báo đã chuyển khoản {{amount}} cho {{no}} qua {{channel}} — kiểm tra tài khoản ngân hàng trước khi xác nhận",
        "customerTurns.candidateLabel": "{{no}} · {{name}} · {{amount}}",
        "customerTurns.workDuplicate": "Việc này đã có — NIVO không làm trùng",
        "customerTurns.staffAsk": "@{{handle}} ơi, khách {{name}} hỏi: “{{question}}”. Em nên trả lời sao ạ?",
        "customerTurns.staffAskDraft": " (Em định trả lời: “{{proposed}}”)",
        "customerTurns.staffCustomerUnknown": "(chưa rõ tên)",
        "customerTurns.applicationStored": "Hồ sơ ứng tuyển đã được ghi nhận ở Tuyển dụng.",
        "customerTurns.applicationNotStored": "Chưa ghi nhận được hồ sơ ứng tuyển: {{message}}",
        "customerTurns.applicationRefusedReply":
            "Mình chưa ghi nhận được hồ sơ: {{message}} Bạn kiểm tra giúp mình nhé.",
        "customerTurns.fallbackEvidence": "fallback: {{reason}}",
        "customerTurns.replyEvidence": "OpenClaw đề xuất câu trả lời; câu trả lời đã qua cổng thẩm quyền",
        "customerTurns.channel.website": "Website chat",
        "customerTurns.channel.telegram": "Telegram",
        "customerTurns.channel.facebook": "Facebook Messenger",
        "customerTurns.channel.instagram": "Instagram",
        "customerTurns.channel.zalo": "Zalo",
        "customerTurns.bookingEvidence": "Yêu cầu đặt lịch từ chat: {{intent}} → {{state}}",
        "customerTurns.redeemBlocked": '{{name}} xin đổi "{{reward}}" nhưng chưa đổi được ({{reason}})',
        "customerTurns.redeemAsked": 'Đã chuyển yêu cầu đổi quà "{{reward}}" của {{name}} ({{cost}} điểm)',
    },
    en: {
        "errors.CUSTOMER_TURNS_TOOLS_URL_INVALID":
            "The public api origin ({{url}}) must be https (http only on a loopback host) so agents call tools safely.",
        "customerTurns.toolsBlock":
            "[OPTIONAL TOOLS] Address: {{url}} — tool list: GET {{url}}; call one tool: POST {{url}}/<tool name> with the header Authorization: Bearer {{token}} and the tool's arguments as the JSON body. The token is valid for this turn only; never repeat it to the customer.",
        "customerTurns.replySummary": "Answer the customer: {{question}}",
        "customerTurns.orderPriceUnknownReply":
            "Thank you! The team will confirm the price of this item with you shortly.",
        "customerTurns.paymentClaimReply":
            "Thank you! We have noted that you transferred the payment for {{no}}. The shop will check it and confirm with you shortly.",
        "customerTurns.paymentConfirmedReply":
            "Thank you! Your payment for {{no}} has already been received and confirmed.",
        "customerTurns.replyAwaitsApproval":
            "The reply waits for approval: this agent may not send through this channel on its own",
        "customerTurns.chatHandoff": "Lead handed to Sales AI · {{verdict}}",
        "customerTurns.verdictAuto": "automatic, within your policy",
        "customerTurns.verdictAsk": "waiting for your decision ({{reason}})",
        "customerTurns.reason.routine": "Routine",
        "customerTurns.reason.missing_data": "Missing data",
        "customerTurns.reason.over_authority": "Over authority",
        "customerTurns.reason.unclear_outcome": "Unclear outcome",
        "customerTurns.reason.not_allowed": "Not granted",
        "customerTurns.orderRecorded": "Order recorded from the chat: {{items}} · {{amount}} → Sales AI",
        "customerTurns.claimRecorded":
            "The customer says they paid {{no}}: waiting for the owner to check the bank account",
        "customerTurns.claimSummary":
            "{{name}} says they paid {{amount}} for {{no}} via {{channel}}: check the bank account before confirming",
        "customerTurns.candidateLabel": "{{no}} · {{name}} · {{amount}}",
        "customerTurns.workDuplicate": "This work already exists; NIVO did not do it twice",
        "customerTurns.staffAsk": "@{{handle}}, customer {{name}} asks: “{{question}}”. How should I answer?",
        "customerTurns.staffAskDraft": " (My draft: “{{proposed}}”)",
        "customerTurns.staffCustomerUnknown": "(name unknown)",
        "customerTurns.applicationStored": "The job application was recorded in Hiring.",
        "customerTurns.applicationNotStored": "The job application could not be recorded: {{message}}",
        "customerTurns.applicationRefusedReply":
            "I could not record your application: {{message}} Could you check it, please?",
        "customerTurns.fallbackEvidence": "fallback: {{reason}}",
        "customerTurns.replyEvidence": "OpenClaw proposed the reply; it passed the authority gate",
        "customerTurns.channel.website": "Website chat",
        "customerTurns.channel.telegram": "Telegram",
        "customerTurns.channel.facebook": "Facebook Messenger",
        "customerTurns.channel.instagram": "Instagram",
        "customerTurns.channel.zalo": "Zalo",
        "customerTurns.bookingEvidence": "Booking request from the chat: {{intent}} → {{state}}",
        "customerTurns.redeemBlocked": '{{name}} asked to redeem "{{reward}}" but cannot yet ({{reason}})',
        "customerTurns.redeemAsked": 'Passed on the request of {{name}} to redeem "{{reward}}" ({{cost}} points)',
    },
}
