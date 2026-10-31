/**
 * The words of the checklist workbook the import reads, which is written in Vietnamese: the name of its status tab, the titles of its
 * columns and what each of its five statuses says. All are compared in lower case with single spaces.
 */
export const DOSSIER_CHECKLIST_WORDS = {
    /** The tab that holds one row per dossier. */
    sheet: "Tình trạng 64 hồ sơ",
    /** The titles of the columns the import needs, and the start of the titles of the ones it may use. */
    columns: {
        ref: "stt",
        category: "hạng mục",
        name: "hồ sơ",
        status: "tình trạng",
        existing: "tài liệu thực tế",
        missing: "còn thiếu",
        drafts: "dự thảo",
    },
    /** What the status cell says for each status; a cell may add words after these ("biểu mẫu (dùng khi phát sinh)"). */
    statuses: {
        present: "đã có",
        partial: "có một phần",
        drafted: "đã soạn dự thảo",
        missing: "chưa có",
        template: "biểu mẫu",
    },
} as const
