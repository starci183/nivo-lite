const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

/** An amount of VND as the shop reads it: `5.000.000 ₫`; empty while the amount is unknown. */
export const moneyLine = (amountVnd: number | null): string =>
    amountVnd === null ? "" : VND.format(Math.round(amountVnd))
