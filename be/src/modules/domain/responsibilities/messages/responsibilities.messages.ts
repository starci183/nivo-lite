import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the responsibilities codes and the lines the capability writes into the evidence log, Vietnamese and English. */
export const RESPONSIBILITIES_MESSAGES: MessageBundle = {
    vi: {
        "errors.RESPONSIBILITIES_LEAD_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "errors.RESPONSIBILITIES_NOT_FOUND": "Không tìm thấy bước phụ trách này.",
        "errors.RESPONSIBILITIES_AGENT_NOT_FOUND": "Người phụ trách đã chọn không phải trợ lý của không gian này.",
        "responsibilities.owner-next": "Người phụ trách: {{owner}} · Bước tiếp theo: {{next}}",
        "responsibilities.invoice-title": "Chuẩn bị hóa đơn cho {{name}}",
        "responsibilities.invoice-next": "Soạn hóa đơn theo phạm vi đã thống nhất để chủ doanh nghiệp duyệt",
        "responsibilities.handed-event":
            "Đã bàn giao cho {{agent}} · Bước tiếp theo: Soạn hóa đơn theo phạm vi đã thống nhất",
    },
    en: {
        "errors.RESPONSIBILITIES_LEAD_NOT_FOUND": "That lead no longer exists.",
        "errors.RESPONSIBILITIES_NOT_FOUND": "That step no longer exists.",
        "errors.RESPONSIBILITIES_AGENT_NOT_FOUND": "The chosen owner is not an agent of this workspace.",
        "responsibilities.owner-next": "Owner: {{owner}} · Next action: {{next}}",
        "responsibilities.invoice-title": "Prepare invoice for {{name}}",
        "responsibilities.invoice-next": "Draft the invoice from the agreed scope for owner approval",
        "responsibilities.handed-event": "Handed to {{agent}} · Next action: Draft the invoice from the agreed scope",
    },
}
