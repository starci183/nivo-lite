import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the knowledge codes and of the owner notices about the AI allowance, Vietnamese and English. */
export const KNOWLEDGE_MESSAGES: MessageBundle = {
    vi: {
        "errors.KNOWLEDGE_MODULE_UNKNOWN": "Không tìm thấy agent này.",
        "errors.KNOWLEDGE_EMBEDDING_UNAVAILABLE": "Chưa kết nối được dịch vụ nhúng văn bản. Sẽ thử lại sau.",
        "reading.refusal.DOCUMENT_TYPE_UNSUPPORTED":
            "Chưa đọc được loại tệp này. Hãy dùng PDF, Word, Excel, PowerPoint, văn bản, CSV, trang HTML hoặc ảnh chụp (JPG, PNG).",
        "reading.refusal.DOCUMENT_LEGACY_OFFICE":
            "Đây là tệp Word/Excel/PowerPoint đời cũ (.doc, .xls, .ppt). Hãy mở tệp, lưu lại thành .docx, .xlsx hoặc .pptx rồi tải lên lại.",
        "reading.refusal.DOCUMENT_TOO_LARGE":
            "Tệp lớn hơn 50 MB, quá mức tối đa cho một tài liệu. Hãy tách thành nhiều tệp nhỏ hơn.",
        "reading.refusal.DOCUMENT_UNREADABLE":
            "Tệp bị hỏng hoặc không đúng loại như tên tệp ghi. Hãy mở thử trên máy, lưu lại rồi tải lên lại.",
        "reading.refusal.DOCUMENT_PASSWORD_PROTECTED":
            "Tệp đang khoá bằng mật khẩu nên không đọc được. Hãy bỏ mật khẩu rồi tải lên lại.",
        "reading.refusal.DOCUMENT_NO_TEXT":
            "Không tìm thấy chữ nào trong tệp này, nên chưa có gì để agent học. Hãy kiểm tra lại tệp hoặc gửi bản có chữ.",
        "reading.refusal.DOCUMENT_READER_UNAVAILABLE":
            "Máy chủ chưa cài bộ đọc cho loại tệp này (ví dụ ảnh HEIC của iPhone). Hãy gửi ảnh JPG/PNG hoặc PDF có chữ.",
        "reading.refusal.DOCUMENT_TRANSCRIPTION_UNAVAILABLE":
            "Tệp chỉ có ảnh, cần AI chép lại chữ trên ảnh, nhưng AI đang không dùng được. Hãy thử lại sau.",
        "reading.refusal.DOCUMENT_NO_CREDITS":
            "Tệp chỉ có ảnh, cần AI chép lại chữ trên ảnh, nhưng workspace đã hết hạn mức AI tháng này. Nạp thêm credit rồi đọc lại.",
        "reading.warning.DOCUMENT_PAGE_UNREADABLE": "Trang {{place}} không đọc được.",
        "reading.warning.DOCUMENT_PAGE_TRANSCRIBED": "Trang {{place}} là ảnh: chữ do AI chép lại từ ảnh, hãy kiểm tra.",
        "reading.warning.DOCUMENT_PAGES_OVER_LIMIT": "{{count}} trang cuối chưa được đọc (quá giới hạn một lần đọc).",
        "reading.warning.DOCUMENT_ROWS_OVER_LIMIT": "Trang tính {{place}}: chỉ đọc {{count}} dòng đầu.",
        "reading.warning.DOCUMENT_PLACE_EMPTY": "{{place}} không có chữ.",
        "usage.notice.warn":
            "Mức dùng AI tháng này đã đạt {{percent}}% hạn mức ({{use}}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing).",
        "usage.notice.exceeded":
            "Workspace đã dùng hết hạn mức AI của tháng này ({{use}}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để chatbot hoạt động lại.",
    },
    en: {
        "errors.KNOWLEDGE_MODULE_UNKNOWN": "This agent was not found.",
        "errors.KNOWLEDGE_EMBEDDING_UNAVAILABLE":
            "The text embedding service could not be reached. It will be tried again.",
        "reading.refusal.DOCUMENT_TYPE_UNSUPPORTED":
            "This file type cannot be read yet. Use PDF, Word, Excel, PowerPoint, text, CSV, an HTML page or a photo (JPG, PNG).",
        "reading.refusal.DOCUMENT_LEGACY_OFFICE":
            "This is an old Word/Excel/PowerPoint file (.doc, .xls, .ppt). Open it, save it as .docx, .xlsx or .pptx and upload that.",
        "reading.refusal.DOCUMENT_TOO_LARGE":
            "The file is over 50 MB, the limit for one document. Split it into smaller files.",
        "reading.refusal.DOCUMENT_UNREADABLE":
            "The file is damaged or not the kind its name says. Open it on your computer, save it again and upload it again.",
        "reading.refusal.DOCUMENT_PASSWORD_PROTECTED":
            "The file is locked with a password. Remove the password and upload it again.",
        "reading.refusal.DOCUMENT_NO_TEXT":
            "No text was found in this file, so there is nothing for the agents to learn. Check the file.",
        "reading.refusal.DOCUMENT_READER_UNAVAILABLE":
            "The server has no reader for this kind of file yet (for example an iPhone HEIC photo). Send a JPG/PNG photo or a PDF with text.",
        "reading.refusal.DOCUMENT_TRANSCRIPTION_UNAVAILABLE":
            "The file is pictures only; the AI that copies their text could not be reached. Try again later.",
        "reading.refusal.DOCUMENT_NO_CREDITS":
            "The file is pictures only; copying their text needs AI, and the workspace has used up this month's AI allowance. Top up and read it again.",
        "reading.warning.DOCUMENT_PAGE_UNREADABLE": "Page {{place}} could not be read.",
        "reading.warning.DOCUMENT_PAGE_TRANSCRIBED":
            "Page {{place}} is a picture: its text was copied by the AI, please check it.",
        "reading.warning.DOCUMENT_PAGES_OVER_LIMIT":
            "The last {{count}} pages were not read (over the limit of one reading).",
        "reading.warning.DOCUMENT_ROWS_OVER_LIMIT": "Sheet {{place}}: only the first {{count}} rows were read.",
        "reading.warning.DOCUMENT_PLACE_EMPTY": "{{place}} has no text.",
        "usage.notice.warn":
            "This month's AI use reached {{percent}}% of the allowance ({{use}}). When it runs out, the chatbot hands customers' questions to staff instead of answering. Top up credits or upgrade the plan at Credits & plans (/billing).",
        "usage.notice.exceeded":
            "The workspace used up its AI allowance for this month ({{use}}). The chatbot stops answering by itself: customers get a polite acknowledgement and their questions go to staff. Top up credits or upgrade the plan at Credits & plans (/billing) to turn the chatbot back on.",
    },
}
