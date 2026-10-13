import type { MessageBundle } from "@modules/platform/i18n"

const URGENCY_LABELS = 'Label the urgency line "Urgency:" / "Mức độ gấp:" and the risk line "Risk:" / "Rủi ro:".'
const CARE_EXAMPLE = 'invite them to book their first session / appointment (e.g. "hẹn lịch buổi đầu")'
const CARE_ADDRESS =
    'Address the customer the way they referred to themselves in the conversation (e.g. "anh" if they wrote "anh"); if unknown use "anh/chị"'
const AUTHORITY_MONEY = '(null for anything not mentioned; "300 triệu" = 300000000)'
const AUTHORITY_HINTS =
    '"tự gửi / tự làm / cứ làm" = auto; "hỏi tôi trước" = ask; "không được / không bao giờ" = never. "đơn trên 20 triệu thì hỏi tôi" = confirm_order with limit_vnd 20000000 and mode null. "hóa đơn" = issue_invoice, "đối soát / thanh toán" = reconcile_payment, "follow-up / theo dõi" = send_follow_up, "báo giá" = send_quote.'
const LEAD_VOICE = "Write warm, brief, natural Vietnamese; address the person as anh/chị unless they showed otherwise."
const ORDER_MONEY = '"1,5 triệu" = 1500000.'

/** Display text of the prompt library: its error and the Vietnamese phrases the prompts quote to the model. */
export const DEEPSEEK_MESSAGES: MessageBundle = {
    vi: {
        "errors.DEEPSEEK_JSON_NOT_RETURNED": "Mô hình không trả về JSON.",
        "prompts.urgencyLabels": URGENCY_LABELS,
        "prompts.careExample": CARE_EXAMPLE,
        "prompts.careAddress": CARE_ADDRESS,
        "prompts.authorityMoney": AUTHORITY_MONEY,
        "prompts.authorityHints": AUTHORITY_HINTS,
        "prompts.orderMoney": ORDER_MONEY,
        "prompts.leadVoice": LEAD_VOICE,
    },
    en: {
        "errors.DEEPSEEK_JSON_NOT_RETURNED": "The model did not return JSON.",
        "prompts.urgencyLabels": URGENCY_LABELS,
        "prompts.careExample": CARE_EXAMPLE,
        "prompts.careAddress": CARE_ADDRESS,
        "prompts.authorityMoney": AUTHORITY_MONEY,
        "prompts.authorityHints": AUTHORITY_HINTS,
        "prompts.orderMoney": ORDER_MONEY,
        "prompts.leadVoice": LEAD_VOICE,
    },
}
