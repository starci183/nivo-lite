/** The sentences and labels of the Excel, CSV and document imports (Vietnamese; the sentences travel as the `detail` of an invalid request). */
export const CSV_COPY = {
    /** Label of each entity. */
    entity: {
        customer: "Khách hàng",
        order: "Đơn hàng",
        product: "Sản phẩm",
        transaction: "Giao dịch",
        other: "Dữ liệu khác",
        document: "Tài liệu",
    },
    /** The unit of the summary for rows. */
    rowUnit: "dòng",
    /** The unit of the summary for documents. */
    documentUnit: "tài liệu",
    /** The import has no saved way of reading columns. */
    noSavedSetup: "Lần nhập này chưa có cách đọc cột được lưu. Hãy tạo lần nhập mới.",
    /** No entity was chosen. */
    chooseEntity: "Hãy chọn loại dữ liệu.",
    /** The name is too short. */
    nameTooShort: "Hãy đặt tên cho lần nhập này (ít nhất 2 ký tự).",
    /** A mapped column is not in the data. */
    columnMissing: (name: string): string => `Cột "${name}" không có trong dữ liệu.`,
    /** Nothing to import. */
    noRows: "Không có dòng nào để nhập. Kiểm tra cột mã và dữ liệu.",
    /** The schedule is not allowed. */
    scheduleInvalid: "Lịch cập nhật không hợp lệ.",
    /** A re-upload with another kind of source. */
    otherSource: "Lần nhập này dùng nguồn khác. Hãy tạo lần nhập mới.",
    /** A document upload into a table import. */
    notDocumentImport: "Lần nhập này không phải lần nhập tài liệu.",
    /** No document and no link. */
    chooseDocuments: "Hãy chọn file tài liệu hoặc dán đường liên kết Google Docs.",
    /** No table file. */
    chooseFile: "Hãy chọn một file .csv hoặc .xlsx.",
    /** No pasted text. */
    pasteTable: "Hãy dán bảng dữ liệu vào ô.",
    /** The pasted text is over ten megabytes. */
    textTooLarge: "File lớn hơn 10 MB.",
    /** A grid with no column name. */
    nameAColumn: "Hãy đặt tên cho ít nhất một cột.",
    /** An unknown source kind. */
    invalidSource: "Nguồn dữ liệu không hợp lệ.",
    /** A document with no text. */
    documentNoText: (label: string): string => `${label}: không có chữ nào để đọc.`,
    /** An empty Google Doc. */
    googleDocEmpty: "Tài liệu Google Docs này đang trống.",
    /** The title of a Google Doc with no text to name it. */
    googleDocTitle: (idStart: string): string => `Google Docs ${idStart}`,
    /** The title of a row with no title column. */
    rowTitle: (line: number): string => `Dòng ${line}`,
    /** File label of typed rows. */
    manualLabel: "Nhập tay",
    /** File label of a Google Sheets link. */
    sheetsLabel: "Google Sheets",
    /** File label of a Google Docs link. */
    docsLabel: "Google Docs",
    /** The note when only an uploaded file exists. */
    uploadAgain: "Tải file mới để cập nhật",
    /** The sheet lost columns. */
    sheetChanged: (columns: string): string =>
        `Trang tính đã đổi tên hoặc mất cột: ${columns}. Mở lại lần nhập để chọn cột mới.`,
    /** The note of a scheduled re-read. */
    syncNote: (added: number, updated: number): string => `Đã nhập ${added} dòng, cập nhật ${updated} dòng`,
} as const
