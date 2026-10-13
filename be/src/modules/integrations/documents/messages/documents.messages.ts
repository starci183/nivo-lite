import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the documents codes, Vietnamese and English. */
export const DOCUMENTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.DOCUMENTS_LINK_INVALID": "Liên kết không hợp lệ.",
        "errors.DOCUMENTS_HOST_PRIVATE": "Chỉ lấy được liên kết công khai (http/https).",
        "errors.DOCUMENTS_NOT_PUBLIC": "Hãy chia sẻ tệp ở chế độ 'Bất kỳ ai có đường liên kết'.",
        "errors.DOCUMENTS_FOLDER_UNSUPPORTED":
            "Chưa đọc được thư mục Google Drive. Hãy thêm thư mục từ hộp 'Thêm tài liệu' hoặc chia sẻ từng tệp.",
        "errors.DOCUMENTS_TYPE_UNSUPPORTED":
            "Chưa đọc được loại tệp này ({{type}}). Hỗ trợ trang web, văn bản, PDF, Word, Excel, PowerPoint và Google Docs, Sheets, Slides.",
        "errors.DOCUMENTS_TOO_LARGE": "Tệp quá lớn để đọc (tối đa {{maxMb}} MB).",
        "errors.DOCUMENTS_FILE_INVALID": "Tệp không phải là tệp {{kind}} hợp lệ.",
        "errors.DOCUMENTS_FILE_UNREADABLE":
            "Không đọc được tệp {{kind}} này (có thể bị khóa, hỏng hoặc chỉ là ảnh quét).",
        "errors.DOCUMENTS_DRIVE_GRANT_MISSING": "Cần cấp quyền Google Drive để đọc tệp riêng tư.",
        "errors.DOCUMENTS_DRIVE_GRANT_LOST": "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.",
        "errors.DOCUMENTS_DRIVE_NO_ACCESS":
            "Tài khoản Google Drive đã kết nối không mở được mục này. Hãy chia sẻ nó với tài khoản đó.",
        "errors.DOCUMENTS_TOKEN_REJECTED": "Phiên Google Drive đã hết hạn. Hãy chọn lại.",
        "errors.DOCUMENTS_DRIVE_ID_INVALID": "Mã tệp hoặc thư mục Google Drive không hợp lệ.",
        "errors.DOCUMENTS_NOT_FOLDER": "Mục này không phải thư mục Google Drive.",
        "errors.DOCUMENTS_UNAVAILABLE": "Không mở được liên kết lúc này ({{status}}). Hãy thử lại sau.",
        "errors.DOCUMENTS_REFUSED": "Không mở được liên kết ({{status}}).",
        "errors.DOCUMENTS_GOOGLE_NOT_CONFIGURED": "Máy chủ chưa được cấu hình để đăng nhập Google.",
        "errors.DOCUMENTS_GOOGLE_GRANT_REVOKED": "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.",
    },
    en: {
        "errors.DOCUMENTS_LINK_INVALID": "The link is not valid.",
        "errors.DOCUMENTS_HOST_PRIVATE": "Only public http or https links can be read.",
        "errors.DOCUMENTS_NOT_PUBLIC": "Share the file with 'Anyone with the link'.",
        "errors.DOCUMENTS_FOLDER_UNSUPPORTED":
            "A Google Drive folder cannot be read from here. Add the folder from the Add documents box, or share each file.",
        "errors.DOCUMENTS_TYPE_UNSUPPORTED":
            "This file type ({{type}}) cannot be read yet. Web pages, text, PDF, Word, Excel, PowerPoint and Google Docs, Sheets and Slides are supported.",
        "errors.DOCUMENTS_TOO_LARGE": "The file is too large to read (at most {{maxMb}} MB).",
        "errors.DOCUMENTS_FILE_INVALID": "The file is not a valid {{kind}} file.",
        "errors.DOCUMENTS_FILE_UNREADABLE":
            "This {{kind}} file cannot be read (it may be locked, damaged or only a scan).",
        "errors.DOCUMENTS_DRIVE_GRANT_MISSING": "Google Drive access is needed to read private files.",
        "errors.DOCUMENTS_DRIVE_GRANT_LOST": "The Google Drive access was revoked. Grant it again.",
        "errors.DOCUMENTS_DRIVE_NO_ACCESS":
            "The connected Google Drive account cannot open this item. Share it with that account.",
        "errors.DOCUMENTS_TOKEN_REJECTED": "The Google Drive session expired. Pick again.",
        "errors.DOCUMENTS_DRIVE_ID_INVALID": "The Google Drive file or folder id is not valid.",
        "errors.DOCUMENTS_NOT_FOLDER": "This item is not a Google Drive folder.",
        "errors.DOCUMENTS_UNAVAILABLE": "The link cannot be opened right now ({{status}}). Try again later.",
        "errors.DOCUMENTS_REFUSED": "The link cannot be opened ({{status}}).",
        "errors.DOCUMENTS_GOOGLE_NOT_CONFIGURED": "The server is not configured for Google sign-in.",
        "errors.DOCUMENTS_GOOGLE_GRANT_REVOKED": "The Google Drive access was revoked. Grant it again.",
    },
}
