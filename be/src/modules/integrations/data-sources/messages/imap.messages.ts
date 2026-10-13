/** Letters that only Vietnamese text carries: a message with one of them is already written for the owner. */
export const VIETNAMESE_LETTER = /[ạảãàáâấầẩẫậắằẳẵặđêếềểễệôốồổỗộơớờởỡợưứừửữựíìỉĩịúùủũụýỳỷỹỵ]/iu

/** The sentences shown to the owner when a mailbox cannot be read. */
export const IMAP_TEXT = {
    appPassword:
        "Hộp thư yêu cầu mật khẩu ứng dụng. Tạo mật khẩu ứng dụng trong cài đặt bảo mật của tài khoản rồi nhập lại.",
    wrongLogin: "Sai mật khẩu ứng dụng hoặc tên đăng nhập.",
    imapDisabled: "Máy chủ không cho đăng nhập IMAP: bật IMAP trong cài đặt hộp thư.",
    hostNotFound: "Không tìm thấy máy chủ thư. Kiểm tra lại địa chỉ máy chủ.",
    refused: "Máy chủ thư từ chối kết nối. Kiểm tra lại cổng và kiểu bảo mật.",
    timeout: "Máy chủ thư không phản hồi trong 10 giây.",
    secureFailed: "Không thiết lập được kết nối bảo mật. Thử cổng 993 (TLS) hoặc 143 (STARTTLS).",
    certInvalid: "Chứng chỉ bảo mật của máy chủ thư không hợp lệ.",
    starttlsFailed: "Không nâng được kết nối lên STARTTLS.",
    folderMissing: "Không tìm thấy thư mục này trong hộp thư.",
    generic: "Không đọc được hộp thư. Kiểm tra lại thông tin kết nối rồi thử lại.",
} as const
