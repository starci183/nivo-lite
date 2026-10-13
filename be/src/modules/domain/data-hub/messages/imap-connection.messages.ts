/** The sentences shown to the owner when a mailbox setting or a mailbox sync is refused. */
export const IMAP_CONNECTION_TEXT = {
    credentialMissing: "Chưa có thông tin đăng nhập hộp thư. Mở kết nối và nhập lại.",
    hostInvalid: "Địa chỉ máy chủ không hợp lệ.",
    portInvalid: "Cổng phải từ 1 đến 65535.",
    securityInvalid: "Kiểu bảo mật không hợp lệ.",
    userMissing: "Nhập tên đăng nhập của hộp thư.",
    passwordMissing: "Nhập mật khẩu ứng dụng của hộp thư.",
    nameInvalid: "Nhập tên kết nối (tối đa 80 ký tự).",
    emailTooLong: "Địa chỉ email quá dài.",
    folderMissing: "Chọn ít nhất một thư mục.",
    sinceInvalid: "Khoảng thời gian không hợp lệ.",
    everyInvalid: "Chu kỳ không hợp lệ.",
    stoppedEarly: "Dừng sớm do hết thời gian, lần sau sẽ tiếp tục.",
} as const

/** The one-line summary of a mailbox: the first folders and the look-back. */
export const imapSummary = (shown: string, sinceDays: number): string => `${shown} · ${sinceDays} ngày`

/** The note that new messages are left for the next run. */
export const imapMoreNote = (folder: string): string => `${folder}: còn thư mới, sẽ lấy tiếp ở lần sau.`
