import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the email-messages codes and of the reasons a send is refused, Vietnamese and English. */
export const EMAIL_MESSAGES_MESSAGES: MessageBundle = {
    vi: {
        "errors.EMAIL_MESSAGES_NOT_RECORDED": "Không ghi được lần gửi email.",
        "email.err_no_smtp": "Chưa cấu hình email gửi đi: hãy kết nối một tài khoản SMTP trong Kết nối > Email gửi đi.",
        "email.err_gate": "Email cho khách chỉ được gửi sau khi đã qua bước kiểm tra quyền.",
        "email.err_rate": "Đã gửi quá nhiều email trong một giờ qua. Thử lại sau.",
        "email.err_bad_recipient": "Địa chỉ email người nhận không hợp lệ.",
        "email.err_attachment": "Tệp đính kèm quá lớn (tối đa 2 MB cho tất cả các tệp).",
        "errors.EMAIL_MESSAGES_SMTP_INVALID": "Có lỗi xảy ra. Vui lòng thử lại.",
        "errors.EMAIL_MESSAGES_SMTP_HOST": "Nhập tên máy chủ SMTP, ví dụ smtp.nhacungcap.com.",
        "errors.EMAIL_MESSAGES_SMTP_PORT": "Cổng phải là một con số, ví dụ 587 hoặc 465.",
        "errors.EMAIL_MESSAGES_SMTP_FIELDS": "Điền tên người gửi, email gửi, tên đăng nhập và mật khẩu.",
        "errors.EMAIL_MESSAGES_SMTP_EMAIL": "Địa chỉ email này không hợp lệ.",
        "errors.EMAIL_MESSAGES_SMTP_PASSWORD": "Nhập mật khẩu mới.",
        "errors.EMAIL_MESSAGES_SMTP_NONE": "Không tìm thấy kết nối này.",
        "errors.EMAIL_MESSAGES_SMTP_NOT_CONNECTED": "Hãy gửi email thử thành công trước.",
        "email.test_subject": "Email thử từ NIVO",
        "email.test_body":
            "Đây là email thử từ NIVO cho {{shop}}.\n\nNếu bạn đọc được thư này, email gửi đi đã hoạt động và NIVO có thể gửi báo cáo, biên nhận thay bạn.",
        "email.test_footer": "Email này được gửi bởi {{shop}}.",
        "email.notice_footer": "Email này được gửi bởi {{shop}}.",
    },
    en: {
        "errors.EMAIL_MESSAGES_NOT_RECORDED": "The email attempt could not be recorded.",
        "email.err_no_smtp":
            "Outgoing email is not set up yet: connect an SMTP account in Connections > Outgoing email.",
        "email.err_gate": "A customer email can only be sent after it has passed the authority check.",
        "email.err_rate": "Too many emails were sent in the last hour. Try again later.",
        "email.err_bad_recipient": "The recipient email address is not valid.",
        "email.err_attachment": "The attachments are too large (2 MB at most for all files together).",
        "errors.EMAIL_MESSAGES_SMTP_INVALID": "Something went wrong. Please try again.",
        "errors.EMAIL_MESSAGES_SMTP_HOST": "Enter the SMTP server name, for example smtp.yourprovider.com.",
        "errors.EMAIL_MESSAGES_SMTP_PORT": "The port must be a number such as 587 or 465.",
        "errors.EMAIL_MESSAGES_SMTP_FIELDS": "Fill in the from name, the from email, the username and the password.",
        "errors.EMAIL_MESSAGES_SMTP_EMAIL": "That email address is not valid.",
        "errors.EMAIL_MESSAGES_SMTP_PASSWORD": "Enter the new password.",
        "errors.EMAIL_MESSAGES_SMTP_NONE": "That connection was not found.",
        "errors.EMAIL_MESSAGES_SMTP_NOT_CONNECTED": "Send a test email successfully first.",
        "email.test_subject": "Test email from NIVO",
        "email.test_body":
            "This is a test email from NIVO for {{shop}}.\n\nIf you can read it, your outgoing email works and NIVO can send reports and receipts for you.",
        "email.test_footer": "This email was sent by {{shop}}.",
        "email.notice_footer": "This email was sent by {{shop}}.",
    },
}
