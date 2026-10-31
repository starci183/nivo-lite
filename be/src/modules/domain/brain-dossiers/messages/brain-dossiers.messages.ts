import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the brain-dossiers codes, Vietnamese and English. */
export const BRAIN_DOSSIERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_DOSSIERS_COLUMNS_MISSING":
            "Trang tính cần một dòng tiêu đề có các cột STT, Hạng mục, Hồ sơ và Tình trạng.",
        "errors.BRAIN_DOSSIERS_EMPTY": "Trang tính không có hồ sơ nào đọc được.",
        "errors.BRAIN_DOSSIERS_TOO_MANY": "Trang tính có hơn {{max}} hồ sơ. Hãy chia nhỏ rồi nhập từng phần.",
    },
    en: {
        "errors.BRAIN_DOSSIERS_COLUMNS_MISSING":
            "The tab needs a header row with the columns STT, Hạng mục, Hồ sơ and Tình trạng.",
        "errors.BRAIN_DOSSIERS_EMPTY": "The tab holds no dossier that could be read.",
        "errors.BRAIN_DOSSIERS_TOO_MANY": "The tab holds more than {{max}} dossiers. Split it and import it in parts.",
    },
}
