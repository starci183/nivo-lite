/** Bytes in a megabyte, as the allowance meter counts them. */
export const BYTES_PER_MB = 1024 * 1024

/** The app formatter, narrowed to the one call the meter makes. */
interface UsageFormatter {
    readonly number: (value: number, options: { maximumFractionDigits: number }) => string
}

/** The workspace's raw document allowance as the meter draws it. */
export interface UsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** What the meter is built from: its worded label, how it words the used and limit megabytes, and the bytes. */
interface UsageInput {
    readonly label: string
    readonly valueLabel: (megabytes: { used: string; limit: string }) => string
    readonly formatter: UsageFormatter
    readonly usage: { readonly usedBytes: number; readonly limitBytes: number }
}

/** How the meter judges a share of the allowance: nearly full is cautionary, full is negative. */
const usageToneOf = (share: number): UsageView["tone"] => {
    if (share >= 1) return "negative"
    return share >= 0.9 ? "cautionary" : "affirmative"
}

/** The meter of the raw document allowance, in megabytes with one decimal in the viewer's language through the app formatter. */
export const usageMeterOf = (input: UsageInput): UsageView => {
    const { usage, formatter } = input
    const megabytes = (bytes: number) => formatter.number(bytes / BYTES_PER_MB, { maximumFractionDigits: 1 })
    return {
        label: input.label,
        value: usage.usedBytes,
        max: usage.limitBytes,
        valueLabel: input.valueLabel({ used: megabytes(usage.usedBytes), limit: megabytes(usage.limitBytes) }),
        tone: usageToneOf(usage.usedBytes / usage.limitBytes),
    }
}
