/** The sentences the owner reads when a file, a link or pasted text cannot be read as a table or a document (Vietnamese; they travel as the `detail` of a rejection). */
export const TABLE_COPY = {
    /** The file holds nothing. */
    noData: "File không có dữ liệu.",
    /** The first row is empty. */
    headerRow: "Dòng đầu tiên phải là tên các cột.",
    /** Too many columns. */
    tooManyColumns: (max: number): string => `File có quá nhiều cột (tối đa ${max}).`,
    /** Too many rows; the limit is already formatted. */
    tooManyRows: (limit: string): string => `File có hơn ${limit} dòng. Hãy chia nhỏ file rồi nhập từng phần.`,
    /** The name of a column that had none. */
    columnName: (position: number): string => `Cột ${position}`,
    /** An empty file. */
    fileEmpty: "File trống.",
    /** A file over ten megabytes. */
    fileTooLarge: "File lớn hơn 10 MB.",
    /** An unsupported table file. */
    onlyTables: "Chỉ nhận file .csv hoặc .xlsx.",
    /** A binary file given as CSV. */
    notCsvText: "File này không phải văn bản CSV.",
    /** A broken .xlsx. */
    badXlsx: "File .xlsx không hợp lệ. File .xls cũ cần lưu lại thành .xlsx.",
    /** An unreadable workbook. */
    unreadableExcel: "Không đọc được file Excel này.",
    /** A workbook with no tabs. */
    noSheets: "File Excel không có trang tính nào.",
    /** Unbalanced quotes. */
    brokenQuotes: "Không đọc được dữ liệu: dấu ngoặc kép bị lệch.",
    /** An unsupported document file. */
    onlyDocuments: (label: string): string => `${label}: chỉ nhận .docx, .pdf, .txt hoặc .md.`,
    /** A binary file given as text. */
    notTextFile: (label: string): string => `${label}: không phải file văn bản.`,
    /** A broken .docx. */
    badDocx: (label: string): string => `${label}: file .docx không hợp lệ.`,
    /** An unreadable Word file. */
    unreadableWord: (label: string): string => `${label}: không đọc được file Word này.`,
    /** A broken PDF. */
    badPdf: (label: string): string => `${label}: file PDF không hợp lệ.`,
    /** An unreadable PDF. */
    unreadablePdf: (label: string): string =>
        `${label}: không đọc được file PDF này (file có thể bị khóa hoặc chỉ là ảnh quét).`,
    /** A bad Google Sheets link. */
    sheetsLinkInvalid: "Đường liên kết Google Sheets không hợp lệ.",
    /** A bad Google Docs link. */
    docsLinkInvalid: "Đường liên kết Google Docs không hợp lệ.",
    /** The shape a Google Sheets link must have. */
    sheetsLinkShape: "Hãy dán đường liên kết dạng docs.google.com/spreadsheets/d/...",
    /** The shape a Google Docs link must have. */
    docsLinkShape: "Hãy dán đường liên kết dạng docs.google.com/document/d/...",
    /** The link is not shared with everyone. */
    googleNotPublic: "Link Google chưa được chia sẻ công khai: bấm Chia sẻ > Bất kỳ ai có đường liên kết.",
    /** The Google answer is over ten megabytes. */
    googleTooLarge: "Dữ liệu từ Google lớn hơn 10 MB.",
    /** Google could not be reached. */
    googleUnreachable: "Không kết nối được tới Google. Hãy thử lại sau.",
    /** Google answered with an error. */
    googleNoData: "Google không trả dữ liệu. Hãy thử lại sau.",
} as const
