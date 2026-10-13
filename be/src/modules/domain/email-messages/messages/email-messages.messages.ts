import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the email-messages codes and of the reasons a send is refused, Vietnamese and English. */
export const EMAIL_MESSAGES_MESSAGES: MessageBundle = {
    vi: {
        "errors.EMAIL_MESSAGES_NOT_RECORDED": "Không ghi được lần gửi email.",
        "email.err_no_smtp": "Chưa cấu hình email gửi đi: hãy kết nối một tài khoản SMTP trong Kết nối > Email gửi đi.",
        "email.err_gate": "Email cho khách chỉ được gửi sau khi đã qua bước kiểm tra quyền.",
        "email.err_rate": "Đã gửi quá nhiều email trong một giờ qua. Thử lại sau.",
        "email.err_bad_recipient": "Địa chỉ email người nhận không hợp lệ.",
    },
    en: {
        "errors.EMAIL_MESSAGES_NOT_RECORDED": "The email attempt could not be recorded.",
        "email.err_no_smtp":
            "Outgoing email is not set up yet: connect an SMTP account in Connections > Outgoing email.",
        "email.err_gate": "A customer email can only be sent after it has passed the authority check.",
        "email.err_rate": "Too many emails were sent in the last hour. Try again later.",
        "email.err_bad_recipient": "The recipient email address is not valid.",
    },
}
