import type { MessageBundle } from "@modules/platform/i18n"

/**
 * Display text of the google codes, and the product text written into the customer's ledger spreadsheet. The `sheet.*` keys are
 * always read from `vi` (existing sheets are found by these exact words); `en` carries the same keys for completeness.
 */
export const GOOGLE_MESSAGES: MessageBundle = {
    vi: {
        "errors.GOOGLE_NOT_CONFIGURED": "Google chưa được thiết lập trên NIVO này.",
        "errors.GOOGLE_UNREACHABLE": "Không kết nối được tới Google. Vui lòng thử lại.",
        "errors.GOOGLE_REFUSED": "Google từ chối yêu cầu.",
        "errors.GOOGLE_CONTRACT_MISMATCH": "Google trả về dữ liệu không đúng định dạng.",
        "sheet.ledgerTab": "Sổ thu chi",
        "sheet.ledgerHeader.date": "Ngày",
        "sheet.ledgerHeader.document": "Số chứng từ",
        "sheet.ledgerHeader.description": "Diễn giải",
        "sheet.ledgerHeader.in": "Thu",
        "sheet.ledgerHeader.out": "Chi",
        "sheet.ledgerHeader.counterpart": "Đối tượng",
        "sheet.ledgerHeader.category": "Phân loại",
        "sheet.ledgerHeader.balance": "Số dư",
        "sheet.ledgerCategory.sale": "Bán hàng",
        "sheet.ledgerCategory.other-income": "Thu khác",
        "sheet.ledgerCategory.deposit": "Tiền cọc",
        "sheet.ledgerCategory.refund": "Hoàn tiền",
        "sheet.ledgerCategory.expense": "Chi phí",
        "sheet.ledgerCategory.unclassified": "Chưa phân loại",
        "sheet.ledgerVoid": "Hoàn tác",
    },
    en: {
        "errors.GOOGLE_NOT_CONFIGURED": "Google is not set up on this NIVO yet.",
        "errors.GOOGLE_UNREACHABLE": "Could not reach Google. Please try again.",
        "errors.GOOGLE_REFUSED": "Google refused the request.",
        "errors.GOOGLE_CONTRACT_MISMATCH": "Google answered in an unexpected shape.",
        "sheet.ledgerTab": "Cash book",
        "sheet.ledgerHeader.date": "Date",
        "sheet.ledgerHeader.document": "Document no.",
        "sheet.ledgerHeader.description": "Description",
        "sheet.ledgerHeader.in": "In",
        "sheet.ledgerHeader.out": "Out",
        "sheet.ledgerHeader.counterpart": "Counterpart",
        "sheet.ledgerHeader.category": "Category",
        "sheet.ledgerHeader.balance": "Balance",
        "sheet.ledgerCategory.sale": "Sale",
        "sheet.ledgerCategory.other-income": "Other income",
        "sheet.ledgerCategory.deposit": "Deposit",
        "sheet.ledgerCategory.refund": "Refund",
        "sheet.ledgerCategory.expense": "Expense",
        "sheet.ledgerCategory.unclassified": "Unclassified",
        "sheet.ledgerVoid": "Reversal",
    },
}
