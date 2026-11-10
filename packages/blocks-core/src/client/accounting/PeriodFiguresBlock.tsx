import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SurfaceCard } from "@starci/grammar/common"
import type { accountingPeriodFiguresBlock } from "../../blocks/accounting/period-figures.block"
import { figureCellsOf, figuresRecord, type FiguresRecord } from "../../rules/accounting/overview-view"
import { parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The figures shown while the first read is in flight. */
const PLACEHOLDER: FiguresRecord = {
    periodKey: "this",
    income: { vnd: 0, count: 0 },
    receivable: { vnd: 0, count: 0 },
    unmatched: { vnd: 0, count: 0 },
    ageing: { d0: { count: 0 }, d30: { count: 0 }, d60: { count: 0 } },
}

/** The four figures of the period, with the line under each in the words of the viewer. */
export const PeriodFiguresBlock = (props: RenderOf<typeof accountingPeriodFiguresBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.figures
    return (
        <SlotView
            slot={parsedSlot(read.slot, figuresRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(figures, isLoading) => {
                const cells = figureCellsOf(figures, {
                    incomeTerm: {
                        this: words({ key: "fig_income_this" }),
                        last: words({ key: "fig_income_last" }),
                    },
                    incomeHint: words({ key: "fig_income_hint" }),
                    receivableTerm: words({ key: "fig_receivable_term" }),
                    receivableHint: words({ key: "fig_receivable_hint" }),
                    unmatchedTerm: words({ key: "fig_unmatched_term" }),
                    unmatchedHint: words({ key: "fig_unmatched_hint" }),
                    ageingTerm: words({ key: "fig_ageing_term" }),
                    ageingHint: words({ key: "fig_ageing_hint" }),
                }).map((cell) => ({ id: cell.id, term: cell.term, value: cell.value, meta: cell.hint }))
                return (
                    <SurfaceCard
                        kind="figures"
                        ariaLabel={words(props.props.label)}
                        isLoading={isLoading}
                        items={cells}
                    />
                )
            }}
        />
    )
}
