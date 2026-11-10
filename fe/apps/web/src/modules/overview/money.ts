/** How a sum of money is written short: a number of thousands, millions or billions, or the sum itself. */
export interface MoneyParts {
    readonly unit: "plain" | "thousand" | "million" | "billion"
    /** The number before the unit: whole for plain and thousand, one decimal for the larger. */
    readonly value: number
}

const ONE_DECIMAL = 10

/** The short form of a sum in dong: 750 thousand, 3.1 million, 1.2 billion. */
export const moneyPartsOf = (vnd: number): MoneyParts => {
    const size = Math.abs(vnd)
    if (size >= 1_000_000_000) return { unit: "billion", value: Math.round((vnd / 1_000_000_000) * ONE_DECIMAL) / ONE_DECIMAL }
    if (size >= 1_000_000) return { unit: "million", value: Math.round((vnd / 1_000_000) * ONE_DECIMAL) / ONE_DECIMAL }
    if (size >= 1_000) return { unit: "thousand", value: Math.round(vnd / 1_000) }
    return { unit: "plain", value: Math.round(vnd) }
}
