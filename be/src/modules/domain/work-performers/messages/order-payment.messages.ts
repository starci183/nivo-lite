import type { MessageBundle } from "@modules/platform/i18n"

/** The lines of the order reconciliation: the work item the owner reads, the reasons it records and the confirmation the customer gets. */
export const ORDER_PAYMENT_MESSAGES: MessageBundle = {
    vi: {
        "performers.orderPaymentSummary": "Đối soát khoản {{amount}} (nội dung: {{ref}}) với đơn đang chờ thanh toán",
        "performers.orderPaymentMatched": "Đã khớp {{amount}} với đơn {{no}} — đã thu tiền",
        "performers.orderPaymentConfirmed": "Shop đã nhận được {{amount}} cho đơn {{no}}. Cảm ơn bạn!",
        "performers.orderPaymentOverdue":
            "Khách {{name}} báo đã chuyển khoản nhưng sau {{minutes}} phút chưa thấy khoản tiền nào khớp — chủ shop cần kiểm tra ngân hàng",
        "performers.orderPaymentEnd.apply": "Khoản tiền khớp một đơn đang chờ thanh toán",
        "performers.orderPaymentEnd.ask": "Chưa chắc khoản tiền thuộc đơn nào — chờ chủ shop quyết định",
        "performers.orderPaymentEnd.leave": "Khoản tiền không thuộc đơn nào",
        "performers.orderPaymentReason.code_and_amount": "Nội dung chuyển khoản có mã đơn và số tiền đúng bằng số cần thanh toán",
        "performers.orderPaymentReason.code_amount_differs": "Nội dung chuyển khoản có mã đơn nhưng số tiền khác số cần thanh toán",
        "performers.orderPaymentReason.code_ambiguous": "Nội dung chuyển khoản có mã của nhiều đơn",
        "performers.orderPaymentReason.no_evidence": "Không có dấu hiệu nào khớp với đơn đang chờ",
        "performers.orderPaymentReason.judge_unavailable": "Chưa nhờ được AI xem xét nên cần người quyết định",
        "performers.orderPaymentReason.amount_differs": "Số tiền khác số cần thanh toán của đơn",
    },
    en: {
        "performers.orderPaymentSummary": "Reconcile {{amount}} (reference: {{ref}}) with the orders waiting for payment",
        "performers.orderPaymentMatched": "Matched {{amount}} to order {{no}}; payment collected",
        "performers.orderPaymentConfirmed": "The shop received {{amount}} for order {{no}}. Thank you!",
        "performers.orderPaymentOverdue":
            "Customer {{name}} said they transferred, but no matching money arrived after {{minutes}} minutes; the owner should check the bank",
        "performers.orderPaymentEnd.apply": "The money matches an order that waits for payment",
        "performers.orderPaymentEnd.ask": "Not sure which order the money belongs to; waiting for the owner",
        "performers.orderPaymentEnd.leave": "The money belongs to no order",
        "performers.orderPaymentReason.code_and_amount": "The transfer content has the order code and the amount due",
        "performers.orderPaymentReason.code_amount_differs": "The transfer content has the order code but the amount differs from the amount due",
        "performers.orderPaymentReason.code_ambiguous": "The transfer content has the codes of several orders",
        "performers.orderPaymentReason.no_evidence": "Nothing matches an order that waits for payment",
        "performers.orderPaymentReason.judge_unavailable": "The AI review was unavailable, so a person decides",
        "performers.orderPaymentReason.amount_differs": "The amount differs from the amount due on the order",
    },
}
