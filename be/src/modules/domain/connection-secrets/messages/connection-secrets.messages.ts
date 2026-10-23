import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the connection-secrets codes, Vietnamese and English. */
export const CONNECTION_SECRETS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONNECTION_SECRETS_KEY_INVALID": "Khóa mã hóa kết nối phải là 32 byte dạng base64.",
        "errors.CONNECTION_SECRETS_NOT_FOUND": "Không tìm thấy kết nối này.",
        "errors.CONNECTION_SECRETS_UNREADABLE": "Không đọc được thông tin đăng nhập của kết nối.",
        "errors.CONNECTION_SECRETS_KEY_MISMATCH":
            "Khóa kết nối không mở được các thông tin đăng nhập đã niêm phong: khóa đã bị ghi đè. Hãy khôi phục khóa cũ, không bao giờ ghi đè nó.",
    },
    en: {
        "errors.CONNECTION_SECRETS_KEY_INVALID": "The connection encryption key must be 32 bytes in base64.",
        "errors.CONNECTION_SECRETS_NOT_FOUND": "That connection was not found.",
        "errors.CONNECTION_SECRETS_UNREADABLE": "The credential of the connection could not be read.",
        "errors.CONNECTION_SECRETS_KEY_MISMATCH":
            "The connection key does not open the credentials already sealed with it: the key was overwritten. Restore the previous key; never overwrite it.",
    },
}
