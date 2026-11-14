import type { HeaderZone } from "@starci/grammar/common" with { "resolution-mode": "import" }
import type { BookPeriod } from "../rules/sales/ledger/book-view"

/** The fields of a switch zone. */
type SwitchFields = Omit<Extract<HeaderZone, { readonly kind: "switch" }>, "kind">

/** The words of the period switch. */
export interface PeriodWords {
    /** The accessible name of the switch. */
    readonly label: string
    /** The words of this month. */
    readonly thisMonth: string
    /** The words of last month. */
    readonly lastMonth: string
}

/** The switch zone between this month and last month: two short fixed options of the block's own data. */
export const periodSwitchOf = (
    words: PeriodWords,
    period: BookPeriod,
    onChange: (period: BookPeriod) => void,
): SwitchFields => ({
    label: words.label,
    items: [
        { id: "this", label: words.thisMonth },
        { id: "last", label: words.lastMonth },
    ],
    selectedKey: period,
    onSelect: (id) => onChange(id === "last" ? "last" : "this"),
})
