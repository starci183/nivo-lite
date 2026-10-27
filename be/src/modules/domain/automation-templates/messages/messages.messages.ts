import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the messages automation templates: names, descriptions, settings, guardrails and starting wording. */
export const MESSAGES_TEMPLATE_MESSAGES: MessageBundle = {
    vi: {
        "automationTemplates.after_hours.name": "Khách hỏi ngoài giờ",
        "automationTemplates.after_hours.description":
            "Khách nhắn khi shop đã đóng cửa được báo sẽ có người gọi lại sáng mai, và nhân viên có sẵn một việc cần gọi.",
        "automationTemplates.after_hours.line": "Khi khách nhắn ngoài giờ mở cửa",
        "automationTemplates.after_hours.settings.openFrom.label": "Mở cửa từ",
        "automationTemplates.after_hours.settings.openFrom.hint":
            "Chỉ dùng khi NIVO không đọc được giờ mở cửa từ thông tin cửa hàng.",
        "automationTemplates.after_hours.settings.openTo.label": "Đóng cửa lúc",
        "automationTemplates.after_hours.guardrails.0": "Chỉ nói sẽ có người gọi lại, không hẹn giờ cụ thể.",
        "automationTemplates.after_hours.guardrails.1":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.after_hours.defaultBody":
            "Cảm ơn bạn đã nhắn cho {ten_shop}. Hiện shop đã ngoài giờ làm việc ({gio_mo_cua}), bên mình sẽ gọi lại cho bạn vào sáng mai nhé!",
        "automationTemplates.ask_review.name": "Xin đánh giá",
        "automationTemplates.ask_review.description":
            "Sau khi khách thanh toán, NIVO xin một lời nhận xét. Nếu khách chê, bạn được báo ngay trong Văn phòng.",
        "automationTemplates.ask_review.line": "Một khoảng thời gian sau khi khách thanh toán",
        "automationTemplates.ask_review.settings.afterDays.suffix": "ngày",
        "automationTemplates.ask_review.settings.afterDays.label": "Hỏi sau",
        "automationTemplates.ask_review.guardrails.0": "Chỉ xin nhận xét, không xin đánh giá 5 sao và không tặng quà.",
        "automationTemplates.ask_review.guardrails.1":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.ask_review.defaultBody":
            "Chào {ten_khach}, cảm ơn bạn đã dùng dịch vụ của {ten_shop}. Bạn thấy trải nghiệm thế nào ạ? Một lời nhận xét ngắn của bạn giúp shop rất nhiều!",
        "automationTemplates.contract_renewal.name": "Nhắc gia hạn hợp đồng",
        "automationTemplates.contract_renewal.description": "Báo khách và báo bạn trước khi hợp đồng định kỳ hết hạn.",
        "automationTemplates.contract_renewal.line": "Một số ngày trước ngày hết hạn hợp đồng",
        "automationTemplates.contract_renewal.settings.beforeDays.suffix": "ngày",
        "automationTemplates.contract_renewal.settings.beforeDays.label": "Nhắc trước",
        "automationTemplates.contract_renewal.settings.beforeDays.hint":
            "Hằng ngày NIVO báo khi còn đúng số ngày này (hoặc ít hơn) là hợp đồng hết hạn.",
        "automationTemplates.contract_renewal.settings.alwaysAsk.label": "Luôn chờ tôi duyệt tin gia hạn",
        "automationTemplates.contract_renewal.settings.alwaysAsk.hint":
            "Bật: tin gia hạn luôn chờ bạn duyệt trước khi gửi, kể cả khi bạn đã cho tự gửi.",
        "automationTemplates.contract_renewal.guardrails.0":
            "Không hứa kết quả, không tự cho giảm giá hay ưu đãi ngoài những gì chủ shop đã ghi.",
        "automationTemplates.contract_renewal.guardrails.1":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.contract_renewal.defaultBody":
            "Chào {ten_khach}, hợp đồng {ten_goi} của bạn với {ten_shop} sẽ hết hạn vào {ngay_het_han}. Bạn có muốn gia hạn để tiếp tục không ạ? Nếu cần hỗ trợ về thanh toán, bạn cứ nhắn lại mình nhé.",
        "automationTemplates.daily_report.name": "Báo cáo cuối ngày",
        "automationTemplates.daily_report.description":
            "Mỗi tối một bản tóm tắt: khách mới, đơn chốt, tiền về và việc đang chờ bạn quyết.",
        "automationTemplates.daily_report.line": "Mỗi ngày vào giờ bạn chọn (giờ Việt Nam)",
        "automationTemplates.daily_report.settings.time.label": "Gửi lúc",
        "automationTemplates.daily_report.settings.toOwnerChat.label": "Gửi thêm vào Telegram của chủ shop",
        "automationTemplates.daily_report.settings.toOwnerChat.hint": "Chỉ gửi khi đã kết nối Telegram.",
        "automationTemplates.daily_report.guardrails.0": "Chỉ dùng số liệu có thật trong NIVO.",
        "automationTemplates.debt_reminder.name": "Nhắc công nợ",
        "automationTemplates.debt_reminder.description":
            "Khoản quá hạn được nhắc nhẹ nhàng. Lần nhắc thứ hai, NIVO báo cho bạn biết.",
        "automationTemplates.debt_reminder.line": "Khi một khoản thanh toán quá hạn",
        "automationTemplates.debt_reminder.settings.afterDays.suffix": "ngày",
        "automationTemplates.debt_reminder.settings.afterDays.label": "Nhắc khi quá hạn",
        "automationTemplates.debt_reminder.guardrails.0": "Lịch sự, không đe doạ, không nhắc tới phí phạt.",
        "automationTemplates.debt_reminder.guardrails.1":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.debt_reminder.defaultBody":
            "Chào {ten_khach}, {ten_shop} xin nhắc nhẹ khoản {so_tien} (mã {ma_phieu}) đã đến hạn. Nếu bạn đã chuyển rồi, bạn bỏ qua tin này giúp mình nhé.",
        "automationTemplates.delivery_notice.name": "Báo giao hàng",
        "automationTemplates.delivery_notice.description":
            "Đơn vừa giao cho đơn vị vận chuyển, NIVO nhắn khách tên hãng và mã vận đơn để khách theo dõi.",
        "automationTemplates.delivery_notice.line": "Khi bạn đánh dấu một đơn đã giao cho vận chuyển",
        "automationTemplates.delivery_notice.guardrails.0":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.delivery_notice.defaultBody":
            "Chào {ten_khach}, đơn {ma_phieu} của bạn tại {ten_shop} đã được giao cho {hang_van_chuyen}. Mã vận đơn: {ma_van_don}. Bạn có thể dùng mã này để theo dõi hành trình nhé!",
        "automationTemplates.thank_payment.name": "Cảm ơn khi nhận tiền",
        "automationTemplates.thank_payment.description":
            "Tiền của khách về, NIVO nhắn một lời cảm ơn trên đúng kênh khách đang chat.",
        "automationTemplates.thank_payment.line": "Mỗi khi nhận được một khoản thanh toán đã đối soát",
        "automationTemplates.thank_payment.settings.minAmount.suffix": "đồng",
        "automationTemplates.thank_payment.settings.minAmount.label": "Chỉ cảm ơn từ số tiền",
        "automationTemplates.thank_payment.settings.minAmount.hint": "Để 0 nếu muốn cảm ơn mọi khoản.",
        "automationTemplates.thank_payment.guardrails.0": "Chỉ cảm ơn và xác nhận số tiền, không hứa thêm gì.",
        "automationTemplates.thank_payment.guardrails.1":
            "Không bịa giá, giờ, địa chỉ hay chính sách chưa có trong thông tin cửa hàng.",
        "automationTemplates.thank_payment.defaultBody":
            "Cảm ơn {ten_khach} đã thanh toán {so_tien}. {ten_shop} rất vui được đồng hành cùng bạn!",
    },
    en: {
        "automationTemplates.after_hours.name": "Messages outside opening hours",
        "automationTemplates.after_hours.description":
            "Customers who write when you are closed are told someone will call back, and staff get a call task.",
        "automationTemplates.after_hours.line": "When a customer writes outside opening hours",
        "automationTemplates.after_hours.settings.openFrom.label": "Opens at",
        "automationTemplates.after_hours.settings.openFrom.hint":
            "Used only when NIVO cannot read the hours from your shop information.",
        "automationTemplates.after_hours.settings.openTo.label": "Closes at",
        "automationTemplates.after_hours.guardrails.0": "Only say someone will call back, no exact time.",
        "automationTemplates.after_hours.guardrails.1":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.after_hours.defaultBody":
            "Thanks for writing to {ten_shop}. We are closed now ({gio_mo_cua}); someone will call you back tomorrow morning.",
        "automationTemplates.ask_review.name": "Ask for a review",
        "automationTemplates.ask_review.description":
            "After a customer pays, NIVO asks for feedback. If it is negative, you are told in the Office.",
        "automationTemplates.ask_review.line": "A while after a customer pays",
        "automationTemplates.ask_review.settings.afterDays.suffix": "days",
        "automationTemplates.ask_review.settings.afterDays.label": "Ask after",
        "automationTemplates.ask_review.guardrails.0": "Ask for feedback only, no star-begging and no gifts.",
        "automationTemplates.ask_review.guardrails.1":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.ask_review.defaultBody":
            "Hi {ten_khach}, thank you for choosing {ten_shop}. How was your experience? A short note helps us a lot!",
        "automationTemplates.contract_renewal.name": "Contract renewal notice",
        "automationTemplates.contract_renewal.description":
            "Notify the customer and you before a recurring contract ends.",
        "automationTemplates.contract_renewal.line": "A number of days before a contract ends",
        "automationTemplates.contract_renewal.settings.beforeDays.suffix": "days",
        "automationTemplates.contract_renewal.settings.beforeDays.label": "Remind before",
        "automationTemplates.contract_renewal.settings.beforeDays.hint":
            "Each day NIVO checks for contracts ending within this many days.",
        "automationTemplates.contract_renewal.settings.alwaysAsk.label": "Always wait for my approval",
        "automationTemplates.contract_renewal.settings.alwaysAsk.hint":
            "On: the renewal message always waits for you before it is sent.",
        "automationTemplates.contract_renewal.guardrails.0":
            "No outcome promises and no discounts beyond what the owner wrote.",
        "automationTemplates.contract_renewal.guardrails.1":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.contract_renewal.defaultBody":
            "Hi {ten_khach}, your contract {ten_goi} with {ten_shop} ends on {ngay_het_han}. Would you like to renew? If you need any help with the payment, just reply here.",
        "automationTemplates.daily_report.name": "End-of-day report",
        "automationTemplates.daily_report.description":
            "Each evening a summary: new customers, deals won, money in and decisions waiting for you.",
        "automationTemplates.daily_report.line": "Every day at the time you pick (Vietnam time)",
        "automationTemplates.daily_report.settings.time.label": "Send at",
        "automationTemplates.daily_report.settings.toOwnerChat.label": "Also send to the owner's Telegram",
        "automationTemplates.daily_report.settings.toOwnerChat.hint": "Only when Telegram is connected.",
        "automationTemplates.daily_report.guardrails.0": "Only real figures from NIVO.",
        "automationTemplates.debt_reminder.name": "Payment reminders",
        "automationTemplates.debt_reminder.description":
            "Overdue amounts get a polite reminder. On the second reminder NIVO tells you.",
        "automationTemplates.debt_reminder.line": "When a payment is overdue",
        "automationTemplates.debt_reminder.settings.afterDays.suffix": "days",
        "automationTemplates.debt_reminder.settings.afterDays.label": "Remind when overdue by",
        "automationTemplates.debt_reminder.guardrails.0": "Polite, no threats, no mention of penalties.",
        "automationTemplates.debt_reminder.guardrails.1":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.debt_reminder.defaultBody":
            "Hi {ten_khach}, a gentle reminder from {ten_shop}: {so_tien} (ref {ma_phieu}) is due. If you already paid, please ignore this.",
        "automationTemplates.delivery_notice.name": "Delivery notice",
        "automationTemplates.delivery_notice.description":
            "When an order is handed to the carrier, NIVO tells the customer the carrier and tracking code.",
        "automationTemplates.delivery_notice.line": "When you mark an order as handed to the carrier",
        "automationTemplates.delivery_notice.guardrails.0":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.delivery_notice.defaultBody":
            "Hi {ten_khach}, your order {ma_phieu} from {ten_shop} is with {hang_van_chuyen}. Tracking code: {ma_van_don}.",
        "automationTemplates.thank_payment.name": "Thank customers when money arrives",
        "automationTemplates.thank_payment.description":
            "When a customer's money arrives, NIVO sends a thank-you on the channel they chat on.",
        "automationTemplates.thank_payment.line": "Every time a payment is matched",
        "automationTemplates.thank_payment.settings.minAmount.suffix": "VND",
        "automationTemplates.thank_payment.settings.minAmount.label": "Only from this amount",
        "automationTemplates.thank_payment.settings.minAmount.hint": "Leave 0 to thank every payment.",
        "automationTemplates.thank_payment.guardrails.0": "Only thank and confirm the amount, promise nothing more.",
        "automationTemplates.thank_payment.guardrails.1":
            "Never invent prices, hours, addresses or policies that are not in the shop information.",
        "automationTemplates.thank_payment.defaultBody":
            "Thank you {ten_khach} for paying {so_tien}. {ten_shop} is glad to have you!",
    },
}
