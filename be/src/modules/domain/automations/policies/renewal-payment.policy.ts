const DONG = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 })

/** True when a contract carries a renewal amount worth an invoice: a positive number of dong. */
export const isBillableAmount = (amount: number | null): amount is number =>
    typeof amount === "number" && Number.isFinite(amount) && amount > 0

/**
 * The transfer content of an invoice: its number with letters and digits only, upper case (`INV-202611-0003` becomes
 * `INV2026110003`), which every bank keeps as typed and the payment match reads back.
 */
export const transferContentOf = (invoiceNo: string): string => invoiceNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** The digits of an amount of dong grouped the Vietnamese way (`1.620.000`). */
export const dongDigits = (amount: number): string => DONG.format(amount)
