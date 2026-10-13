import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the n8n runs codes, Vietnamese and English. */
export const N8N_RUNS_MESSAGES: MessageBundle = {
    vi: {
        "errors.N8N_RUNS_TEMPLATE_KEY_INVALID": "Mã mẫu tự động hoá {{key}} không hợp lệ.",
        "errors.N8N_RUNS_API_BASE_MISSING": "Chưa cấu hình địa chỉ để n8n gọi lại NIVO.",
        "errors.N8N_RUNS_RUN_UNAUTHORIZED": "Lượt chạy này không hợp lệ hoặc đã hết hạn.",
        "errors.N8N_RUNS_EMAIL_INCOMPLETE": "Email thiếu người nhận hoặc mẫu nội dung.",
        "errors.N8N_RUNS_RECIPIENT_BLOCKED": "Người nhận không phải chủ shop của workspace này.",
        "errors.N8N_RUNS_WORKFLOW_MISMATCH": "Lượt chạy này không thuộc quy trình đang gọi.",
        "errors.N8N_RUNS_NOT_CLOSED": "Không đóng được lượt chạy này.",
    },
    en: {
        "errors.N8N_RUNS_TEMPLATE_KEY_INVALID": "The automation template key {{key}} is invalid.",
        "errors.N8N_RUNS_API_BASE_MISSING": "The address n8n calls NIVO back on is not configured.",
        "errors.N8N_RUNS_RUN_UNAUTHORIZED": "This run is invalid or has expired.",
        "errors.N8N_RUNS_EMAIL_INCOMPLETE": "The email has no recipient or no content template.",
        "errors.N8N_RUNS_RECIPIENT_BLOCKED": "The recipient is not an owner of this workspace.",
        "errors.N8N_RUNS_WORKFLOW_MISMATCH": "This run does not belong to the calling workflow.",
        "errors.N8N_RUNS_NOT_CLOSED": "The run could not be closed.",
    },
}
