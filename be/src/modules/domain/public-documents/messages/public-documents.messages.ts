import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the public-documents codes, Vietnamese and English. */
export const PUBLIC_DOCUMENTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.PUBLIC_DOCUMENTS_NOT_FOUND": "Không tìm thấy tài liệu công khai này.",
        "errors.PUBLIC_DOCUMENTS_TITLE_REQUIRED": "Cần đặt tên cho tài liệu công khai.",
        "errors.PUBLIC_DOCUMENTS_BODY_REQUIRED": "Tài liệu công khai đang trống. Hãy viết nội dung trước khi duyệt.",
        "errors.PUBLIC_DOCUMENTS_BODY_TOO_LONG": "Nội dung dài quá {{max}} ký tự.",
        "errors.PUBLIC_DOCUMENTS_SOURCES_REQUIRED": "Hãy chọn ít nhất một tài liệu công khai để NIVO soạn từ đó.",
        "errors.PUBLIC_DOCUMENTS_TOO_MANY_SOURCES": "Chỉ chọn tối đa {{max}} tài liệu công khai cho một bản nháp.",
        "errors.PUBLIC_DOCUMENTS_SOURCE_NOT_READY":
            "Một tài liệu đã chọn không còn hoặc chưa đọc xong. Hãy chọn tài liệu công khai đã sẵn sàng.",
        "errors.PUBLIC_DOCUMENTS_SOURCE_INTERNAL":
            "Một tài liệu đã chọn nằm trong vùng nội bộ. Hãy chuyển nó sang vùng công khai trước.",
        "errors.PUBLIC_DOCUMENTS_NOT_EDITABLE": "Tài liệu đang được soạn hoặc đã lưu trữ nên chưa sửa được.",
        "errors.PUBLIC_DOCUMENTS_STALE_REVIEW": "Nội dung đã thay đổi. Hãy đọc bản mới rồi duyệt lại.",
        "errors.PUBLIC_DOCUMENTS_SOURCES_CHANGED":
            "Tài liệu nội bộ nguồn đã đổi sau lần duyệt trước. Hãy xem thay đổi rồi duyệt lại.",
        "errors.PUBLIC_DOCUMENTS_NO_INTERNAL_RIGHT":
            "Chưa agent nào được quyền đọc tài liệu nội bộ để soạn. Hãy bật công cụ nivo.tool.brain.document.read cho một agent nội bộ ở mục Quyền.",
        "errors.PUBLIC_DOCUMENTS_DRAFT_UNAVAILABLE": "NIVO chưa soạn được lúc này. Hãy thử lại sau.",
        "errors.PUBLIC_DOCUMENTS_NOTHING_LEFT":
            "Các tài liệu đã chọn không có nội dung để NIVO soạn thành bài cho khách.",
    },
    en: {
        "errors.PUBLIC_DOCUMENTS_STALE_REVIEW": "The content changed. Read the current revision before approving it.",
        "errors.PUBLIC_DOCUMENTS_NOT_FOUND": "This public document was not found.",
        "errors.PUBLIC_DOCUMENTS_TITLE_REQUIRED": "A public document needs a title.",
        "errors.PUBLIC_DOCUMENTS_BODY_REQUIRED": "The public document is empty. Write its text before approving.",
        "errors.PUBLIC_DOCUMENTS_BODY_TOO_LONG": "The text is longer than {{max}} characters.",
        "errors.PUBLIC_DOCUMENTS_SOURCES_REQUIRED": "Choose at least one public document for NIVO to draft from.",
        "errors.PUBLIC_DOCUMENTS_TOO_MANY_SOURCES": "Choose at most {{max}} public documents for one draft.",
        "errors.PUBLIC_DOCUMENTS_SOURCE_NOT_READY":
            "A chosen document is gone or not read yet. Choose ready public documents.",
        "errors.PUBLIC_DOCUMENTS_SOURCE_INTERNAL":
            "A chosen document is in the internal area. Move it to the public area first.",
        "errors.PUBLIC_DOCUMENTS_NOT_EDITABLE":
            "The document is being drafted or archived, so it cannot be edited now.",
        "errors.PUBLIC_DOCUMENTS_SOURCES_CHANGED":
            "An internal source changed since the last approval. Review the change, then approve again.",
        "errors.PUBLIC_DOCUMENTS_NO_INTERNAL_RIGHT":
            "No agent holds the right to read internal documents for drafting. Turn on the nivo.tool.brain.document.read tool for an internal agent under Rights.",
        "errors.PUBLIC_DOCUMENTS_DRAFT_UNAVAILABLE": "NIVO could not draft right now. Try again later.",
        "errors.PUBLIC_DOCUMENTS_NOTHING_LEFT":
            "The chosen documents hold nothing NIVO could write a text for customers from.",
    },
}
