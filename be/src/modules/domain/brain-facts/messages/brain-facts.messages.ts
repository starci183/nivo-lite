import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the brain-facts codes, Vietnamese and English. */
export const BRAIN_FACTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BRAIN_FACTS_INCOMPLETE": "Một sự thật cần có đối tượng, thuộc tính và giá trị.",
        "errors.BRAIN_FACTS_NOT_FOUND": "Không tìm thấy sự thật này.",
        "errors.BRAIN_FACTS_NOT_PROPOSED": "Sự thật này không còn chờ quyết định.",
        "errors.BRAIN_FACTS_NOT_A_VALUE": "Chỉ một giá trị được đề xuất mới chọn hoặc tách được.",
        "errors.BRAIN_FACTS_NOT_ACTIVE": "Sự thật này không còn hiệu lực.",
        "errors.BRAIN_FACTS_SITUATION_REQUIRED": "Hãy nêu hoàn cảnh mà giá trị mới áp dụng.",
    },
    en: {
        "errors.BRAIN_FACTS_INCOMPLETE": "A fact needs a subject, an attribute and a value.",
        "errors.BRAIN_FACTS_NOT_FOUND": "This fact was not found.",
        "errors.BRAIN_FACTS_NOT_PROPOSED": "This fact is no longer waiting for a decision.",
        "errors.BRAIN_FACTS_NOT_A_VALUE": "Only a proposed value can be chosen or split.",
        "errors.BRAIN_FACTS_NOT_ACTIVE": "This fact is no longer in force.",
        "errors.BRAIN_FACTS_SITUATION_REQUIRED": "Name the situation the new value is for.",
    },
}
