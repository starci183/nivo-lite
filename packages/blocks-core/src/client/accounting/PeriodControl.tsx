import type { ReactNode } from "react"
import { Tabs } from "@starci/grammar/common"
import type { BookPeriod } from "../../rules/accounting/book-view"
import { useBlockWords } from "../composites/useBlockWords"

/** What the period control takes. */
interface PeriodControlProps {
    /** The period shown now. */
    readonly period: BookPeriod
    /** Called with the period the person chose. */
    readonly onChange: (period: BookPeriod) => void
}

/** The switch between this month and last month that heads the weekly chart and the cash book: the tabs of the block, not joined buttons. */
export const PeriodControl = (props: PeriodControlProps): ReactNode => {
    const words = useBlockWords()
    return (
        <Tabs
            label={words({ key: "ledger_period" })}
            items={[
                { id: "this", label: words({ key: "book_period_this" }) },
                { id: "last", label: words({ key: "book_period_last" }) },
            ]}
            selectedKey={props.period}
            onSelect={(id) => props.onChange(id === "last" ? "last" : "this")}
            inset="none"
        />
    )
}
