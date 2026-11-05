/** An amount of VND as a line with thousands separators: `5,000,000 VND`; empty while the amount is unknown. */
export const moneyLine = (amountVnd: number | null): string =>
    amountVnd === null ? "" : `${new Intl.NumberFormat("en-US").format(Math.round(amountVnd))} VND`
