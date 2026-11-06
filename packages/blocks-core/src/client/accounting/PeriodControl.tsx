import type { ReactNode } from "react"
import { ChoiceChips } from "@starci/grammar/common"
import type { BookPeriod } from "../../rules/accounting/book-view"
import { useBlockWords } from "../composites/useBlockWords"

/** What the period control takes. */
interface PeriodControlProps {
    /** The period shown now. */
    readonly period: BookPeriod
    /** Called with the period the person chose. */
    readonly onChange: (period: BookPeriod) => void
}

/** The switch between this month and last month that heads the weekly chart and the cash book. */
export const PeriodControl = (props: PeriodControlProps): ReactNode => {
    const words = useBlockWords()
    return (
        <ChoiceChips
            label={words({ key: "ledger_period" })}
            isLabelHidden
            empty={null}
            options={[
                { value: "this", label: words({ key: "book_period_this" }) },
                { value: "last", label: words({ key: "book_period_last" }) },
            ]}
            value={props.period}
            onValueChange={(value) => props.onChange(value === "last" ? "last" : "this")}
        />
    )
}
