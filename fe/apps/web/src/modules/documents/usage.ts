/** Bytes in a megabyte, as the allowance meter counts them. */
export const BYTES_PER_MB: number = 1024 * 1024

/** The app formatter, narrowed to the one call the meter makes. */
interface UsageFormatter {
    readonly number: (
        value: number,
        options: { maximumFractionDigits: number; style: "unit"; unit: "kilobyte" | "megabyte" },
    ) => string
}

/** The workspace's raw document allowance as the meter draws it. */
export interface UsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** Bytes in a kilobyte, as the allowance meter counts them. */
const BYTES_PER_KB: number = 1024

/** What the meter is built from: its worded label, how it words the used and limit sizes, and the bytes. */
interface UsageInput {
    readonly label: string
    readonly valueLabel: (sizes: { used: string; limit: string }) => string
    readonly formatter: UsageFormatter
    readonly usage: { readonly usedBytes: number; readonly limitBytes: number }
}

/** How the meter judges a share of the allowance: nearly full is cautionary, full is negative. */
const usageToneOf = (share: number): UsageView["tone"] => {
    if (share >= 1) return "negative"
    return share >= 0.9 ? "cautionary" : "affirmative"
}

/**
 * A size with its unit in the viewer's language: megabytes with one decimal, and kilobytes below one megabyte so a small file never
 * reads as 0 MB. Nothing used at all reads as 0 MB.
 */
const sizeLabelOf = (formatter: UsageFormatter, bytes: number): string =>
    bytes > 0 && bytes < BYTES_PER_MB
        ? formatter.number(Math.max(1, Math.round(bytes / BYTES_PER_KB)), {
              maximumFractionDigits: 0,
              style: "unit",
              unit: "kilobyte",
          })
        : formatter.number(bytes / BYTES_PER_MB, { maximumFractionDigits: 1, style: "unit", unit: "megabyte" })

/** The meter of the raw document allowance: sizes with their unit in the viewer's language through the app formatter. */
export const usageMeterOf = (input: UsageInput): UsageView => {
    const { usage, formatter } = input
    const megabytes = (bytes: number) => sizeLabelOf(formatter, bytes)
    return {
        label: input.label,
        value: usage.usedBytes,
        max: usage.limitBytes,
        valueLabel: input.valueLabel({ used: megabytes(usage.usedBytes), limit: megabytes(usage.limitBytes) }),
        tone: usageToneOf(usage.usedBytes / usage.limitBytes),
    }
}
