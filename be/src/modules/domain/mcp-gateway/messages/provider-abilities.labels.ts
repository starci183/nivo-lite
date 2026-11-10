/** A display name in the owner's two languages. */
export interface AbilityLabel {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The display name of each provider kind. */
export const KIND_LABELS: Readonly<Record<string, AbilityLabel>> = {
    messaging: { vi: "Nhắn tin", en: "Messaging" },
    payment: { vi: "Thanh toán", en: "Payment" },
    books: { vi: "Sổ sách", en: "Books" },
}

/** The display name of each provider. */
export const PROVIDER_LABELS: Readonly<Record<string, AbilityLabel>> = {
    zalo_oa: { vi: "Zalo OA", en: "Zalo OA" },
    telegram: { vi: "Telegram", en: "Telegram" },
    meta: { vi: "Facebook, Instagram", en: "Facebook, Instagram" },
    sepay: { vi: "SePay", en: "SePay" },
    payos: { vi: "payOS", en: "payOS" },
    google: { vi: "Google", en: "Google" },
}

/** The display name of each ability, in business words, by provider then ability id. */
export const ABILITY_LABELS: Readonly<Record<string, Readonly<Record<string, AbilityLabel>>>> = {
    zalo_oa: {
        "customer.send": { vi: "Gửi tin cho khách qua Zalo", en: "Send to customers on Zalo" },
    },
    telegram: {
        "customer.send": { vi: "Gửi tin cho khách qua Telegram", en: "Send to customers on Telegram" },
    },
    meta: {
        "customer.send": {
            vi: "Gửi tin cho khách qua Facebook, Instagram",
            en: "Send to customers on Facebook and Instagram",
        },
    },
    sepay: {
        "transactions.read": { vi: "Đọc giao dịch ngân hàng", en: "Read bank transactions" },
        "credit.rematch": { vi: "Dò lại tiền về theo đơn", en: "Rematch a credit to an order" },
        "qr.create": { vi: "Tạo mã QR thanh toán", en: "Create a payment QR" },
    },
    google: {
        "ledger.read": { vi: "Xem sổ Google Sheet", en: "Read the Google Sheet ledger status" },
        "ledger.write": { vi: "Ghi sổ Google Sheet", en: "Write the Google Sheet ledger" },
        "drive.read": { vi: "Xem tài liệu Google Drive", en: "Read Google Drive sources" },
    },
}

/** The label of a key in a table, or the key itself in both languages when the table has none (a spec keeps the tables whole). */
export const labelOf = (table: Readonly<Record<string, AbilityLabel>> | undefined, key: string): AbilityLabel =>
    table?.[key] ?? { vi: key, en: key }
