import type { MessageBundle } from "@modules/platform/i18n"

/** The human-facing correction errors, in both supported languages. */
export const ACCOUNTING_ADJUSTMENTS_MESSAGES: MessageBundle = {
vi: { "errors.ACCOUNTING_ADJUSTMENTS_NOT_FOUND": "Không tìm thấy bản ghi cần điều chỉnh trong không gian làm việc.", "errors.ACCOUNTING_ADJUSTMENTS_INVALID": "Nội dung hoặc số tiền điều chỉnh không hợp lệ.", "errors.ACCOUNTING_ADJUSTMENTS_NOT_CREATED": "Không thể ghi nhận điều chỉnh." },
en: { "errors.ACCOUNTING_ADJUSTMENTS_NOT_FOUND": "The correction target was not found in this workspace.", "errors.ACCOUNTING_ADJUSTMENTS_INVALID": "The correction note or amount is invalid.", "errors.ACCOUNTING_ADJUSTMENTS_NOT_CREATED": "The correction could not be recorded." },
}
