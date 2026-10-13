import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the mail codes, Vietnamese and English. */
export const MAIL_MESSAGES: MessageBundle = {
    vi: {
        "errors.MAIL_AUTH": "Sai tên đăng nhập hoặc mật khẩu. Kiểm tra lại địa chỉ email và mật khẩu bạn đã dán.",
        "errors.MAIL_APP_PASSWORD":
            "Sai mật khẩu ứng dụng. Hãy tạo mật khẩu ứng dụng mới (Google cần bật Xác minh 2 bước trước), dán đúng 16 ký tự, không dùng mật khẩu đăng nhập thường.",
        "errors.MAIL_CONNECT":
            "Không kết nối được máy chủ. Kiểm tra tên máy chủ và cổng, và máy chủ có cho phép kết nối từ internet.",
        "errors.MAIL_TIMEOUT":
            "Máy chủ email không trả lời kịp. Kiểm tra tên máy chủ và cổng, hoặc thử lại sau một phút.",
        "errors.MAIL_DNS": "Tên máy chủ này không tồn tại. Kiểm tra lại chính tả của máy chủ SMTP.",
        "errors.MAIL_TLS":
            "Kết nối bảo mật bị lỗi. Thử đổi mục Bảo mật (STARTTLS cổng 587, SSL/TLS cổng 465) hoặc kiểm tra tên máy chủ.",
        "errors.MAIL_SENDER":
            "Máy chủ không cho phép gửi từ địa chỉ này. Hãy dùng đúng hộp thư bạn đăng nhập, hoặc địa chỉ nhà cung cấp đã xác minh cho việc gửi.",
        "errors.MAIL_RECIPIENT": "Địa chỉ người nhận bị từ chối. Kiểm tra lại chính tả.",
        "errors.MAIL_LIMIT": "Đã chạm giới hạn gửi của nhà cung cấp. Thử lại sau.",
        "errors.MAIL_UNKNOWN": "Máy chủ email từ chối thư này.",
        "errors.MAIL_NOT_CONFIGURED": "Hệ thống chưa cấu hình người gửi thông báo.",
    },
    en: {
        "errors.MAIL_AUTH": "Wrong username or password. Check the address and the password you pasted.",
        "errors.MAIL_APP_PASSWORD":
            "Wrong app password. Create a new app password (Google needs 2-Step Verification first), paste exactly the 16 characters, and not your normal password.",
        "errors.MAIL_CONNECT":
            "Could not connect to the mail server. Check the server name and the port, and that the server accepts connections from the internet.",
        "errors.MAIL_TIMEOUT":
            "The mail server did not answer in time. Check the server name and port, or try again in a minute.",
        "errors.MAIL_DNS": "That server name does not exist. Check the spelling of the SMTP server.",
        "errors.MAIL_TLS":
            "The secure connection failed. Try the other Security option (STARTTLS on 587, SSL/TLS on 465) or check the server name.",
        "errors.MAIL_SENDER":
            "The server refuses this sender address. Use the mailbox you logged in with, or an address your provider has verified for sending.",
        "errors.MAIL_RECIPIENT": "The recipient address was refused. Check that it is spelled correctly.",
        "errors.MAIL_LIMIT": "The provider's sending limit was reached. Try again later.",
        "errors.MAIL_UNKNOWN": "The mail server refused the message.",
        "errors.MAIL_NOT_CONFIGURED": "The platform has no sender for notices configured.",
    },
}
