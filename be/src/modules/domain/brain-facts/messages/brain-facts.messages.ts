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
        "errors.BRAIN_FACTS_RELATION_INVALID": "Một quan hệ nối hai sự thật khác nhau, đúng loại, nhãn ngắn.",
        "errors.BRAIN_FACTS_RELATION_NOT_FOUND": "Không tìm thấy quan hệ này.",
        "errors.BRAIN_FACTS_VALUE_NOT_OF_TYPE": "Giá trị này không đúng kiểu của sự thật đang hiệu lực.",
        "errors.BRAIN_FACTS_ADDRESSED_TO_AI": "Dòng này là lời nhắn cho AI, không phải một sự thật của tiệm.",
        "errors.BRAIN_FACTS_IN_FORCE_FULL": "Số sự thật đang hiệu lực đã chạm trần; sự thật này chờ anh/chị duyệt.",
    },
    en: {
        "errors.BRAIN_FACTS_INCOMPLETE": "A fact needs a subject, an attribute and a value.",
        "errors.BRAIN_FACTS_NOT_FOUND": "This fact was not found.",
        "errors.BRAIN_FACTS_NOT_PROPOSED": "This fact is no longer waiting for a decision.",
        "errors.BRAIN_FACTS_NOT_A_VALUE": "Only a proposed value can be chosen or split.",
        "errors.BRAIN_FACTS_NOT_ACTIVE": "This fact is no longer in force.",
        "errors.BRAIN_FACTS_SITUATION_REQUIRED": "Name the situation the new value is for.",
        "errors.BRAIN_FACTS_RELATION_INVALID": "A relation joins two different facts, with a known kind and a short label.",
        "errors.BRAIN_FACTS_RELATION_NOT_FOUND": "This relation was not found.",
        "errors.BRAIN_FACTS_VALUE_NOT_OF_TYPE": "This value is not of the type of the truth in force.",
        "errors.BRAIN_FACTS_ADDRESSED_TO_AI": "This line speaks to the AI; it is not a truth of the shop.",
        "errors.BRAIN_FACTS_IN_FORCE_FULL": "The truths in force reached their ceiling; this truth waits for your approval.",
    },
}
