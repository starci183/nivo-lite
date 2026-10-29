import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the identity codes, Vietnamese and English. */
export const IDENTITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.IDENTITY_UNAUTHENTICATED": "Bạn cần đăng nhập để thực hiện thao tác này.",
        "errors.IDENTITY_ACCESS_TOKEN_INVALID": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        "errors.IDENTITY_INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "errors.IDENTITY_ACCOUNT_DISABLED": "Tài khoản này đã bị khóa.",
        "errors.IDENTITY_REFRESH_INVALID": "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
        "errors.IDENTITY_REFRESH_REUSED": "Phiên đăng nhập không an toàn nên đã bị đóng. Hãy đăng nhập lại.",
        "errors.IDENTITY_RESET_TOKEN_INVALID":
            "Liên kết đặt mật khẩu không hợp lệ hoặc đã được dùng. Hãy yêu cầu liên kết mới.",
        "errors.IDENTITY_PASSWORD_INVALID": "Mật khẩu cần từ 8 đến 72 ký tự.",
        "errors.IDENTITY_TOO_MANY_ATTEMPTS": "Bạn thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.",
        "errors.IDENTITY_GOOGLE_EMAIL_UNVERIFIED": "Google chưa xác minh email này nên không thể đăng nhập.",
        "errors.IDENTITY_EMAIL_NOT_CONFIRMED": "Hãy xác nhận email qua liên kết chúng tôi đã gửi trước khi đăng nhập.",
        "errors.IDENTITY_ACCOUNT_NOT_FOUND": "Không tìm thấy tài khoản.",
    },
    en: {
        "errors.IDENTITY_UNAUTHENTICATED": "You need to sign in to do this.",
        "errors.IDENTITY_ACCESS_TOKEN_INVALID": "The session is invalid or has expired.",
        "errors.IDENTITY_INVALID_CREDENTIALS": "The email or password is wrong.",
        "errors.IDENTITY_ACCOUNT_DISABLED": "This account is disabled.",
        "errors.IDENTITY_REFRESH_INVALID": "Your session has expired. Please sign in again.",
        "errors.IDENTITY_REFRESH_REUSED": "That session was not safe and has been closed. Please sign in again.",
        "errors.IDENTITY_RESET_TOKEN_INVALID": "The password link is invalid or already used. Request a new one.",
        "errors.IDENTITY_PASSWORD_INVALID": "The password must be 8 to 72 characters.",
        "errors.IDENTITY_TOO_MANY_ATTEMPTS": "Too many attempts. Wait a while and try again.",
        "errors.IDENTITY_GOOGLE_EMAIL_UNVERIFIED": "Google has not verified this email, so it cannot sign in.",
        "errors.IDENTITY_EMAIL_NOT_CONFIRMED": "Confirm your email through the link we sent before signing in.",
        "errors.IDENTITY_ACCOUNT_NOT_FOUND": "Account not found.",
    },
}
