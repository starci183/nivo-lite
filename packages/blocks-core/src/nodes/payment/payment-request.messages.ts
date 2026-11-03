/** The languages a payment request is written in. */
export type RequestLocale = "vi" | "en"

/** The lines of a payment request. */
export interface RequestWords {
    /** The opening line; takes `{{items}}` and `{{amount}}`. */
    readonly intro: string
    /** The bank line; takes `{{bank}}`. */
    readonly bank: string
    /** The account number line; takes `{{account}}`. */
    readonly account: string
    /** The account holder line; takes `{{holder}}`. */
    readonly holder: string
    /** The transfer content line; takes `{{content}}`. */
    readonly content: string
    /** The QR link line; takes `{{url}}`. */
    readonly qr: string
    /** The closing line. */
    readonly outro: string
    /** The currency suffix after an amount. */
    readonly currency: string
    /** The title of the owner work item raised without a SePay account; takes `{{order}}`. */
    readonly noAccount: string
}

/** The words of a payment request by language. */
export const REQUEST_WORDS: Readonly<Record<RequestLocale, RequestWords>> = {
    vi: {
        intro: "Đơn của bạn đã được xác nhận: {{items}} · {{amount}}.\nBạn vui lòng chuyển khoản theo thông tin sau:",
        bank: "Ngân hàng: {{bank}}",
        account: "Số tài khoản: {{account}}",
        holder: "Chủ tài khoản: {{holder}}",
        content: "Nội dung chuyển khoản (ghi đúng): {{content}}",
        qr: "Hoặc quét mã QR: {{url}}",
        outro: "Chuyển khoản xong bạn nhắn lại cho shop nhé.",
        currency: "đ",
        noAccount: "Đơn {{order}} chưa gửi được thông tin thanh toán: chưa kết nối SePay có đủ số tài khoản",
    },
    en: {
        intro: "Your order is confirmed: {{items}} · {{amount}}.\nPlease transfer with these details:",
        bank: "Bank: {{bank}}",
        account: "Account number: {{account}}",
        holder: "Account holder: {{holder}}",
        content: "Transfer content (type exactly): {{content}}",
        qr: "Or scan the QR code: {{url}}",
        outro: "Once you have transferred, just message us here.",
        currency: "VND",
        noAccount: "Order {{order}} has no payment request: no SePay connection with a full account number",
    },
}
