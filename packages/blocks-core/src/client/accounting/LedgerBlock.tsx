import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, Stack, SurfaceCard } from "@starci/grammar/common"
import { surfaceFrame } from "../composites/surfaceFrame"
import type { TableColumnData, TableGroupData } from "@starci/grammar/common"
import type { accountingLedgerBlock } from "../../blocks/accounting/ledger.block"
import { bookPeriodOf } from "../../rules/accounting/book-view"
import type { Ledger } from "../../rules/accounting/ledger"
import { bandOf, ledgerRecord, sectionsOf } from "../../rules/accounting/ledger-view"
import type { LedgerSection } from "../../rules/accounting/ledger-view"
import { periodSwitchOf } from "../../rows/period-switch"
import { parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The book shown while the first read is in flight. */
const PLACEHOLDER: Ledger = {
    openingVnd: 0,
    inVnd: 0,
    outVnd: 0,
    closingVnd: 0,
    days: [
        {
            day: "2026-01-01",
            inVnd: 0,
            outVnd: 0,
            balanceVnd: 0,
            lines: [{ id: "placeholder", title: "........", kind: "income", inVnd: 0, outVnd: 0, balanceVnd: 0 }],
        },
    ],
}

/** The days of the book as the groups of one table: a heading row for each day with its closing balance, then its lines. */
const groupsOf = (sections: ReadonlyArray<LedgerSection>, closingLabel: string): ReadonlyArray<TableGroupData> =>
    sections.map((section) => ({
        id: section.day,
        label: section.day,
        fact: `${closingLabel} ${section.balance}`,
        rows: section.rows.map((row) => ({
            id: row.id,
            cells: { entry: row.title, income: row.income, expense: row.expense, balance: row.balance },
        })),
    }))

/** The cash book of the period: the band of balances as its own card, then one table card whose groups are the days, the period switch in its header. */
export const LedgerBlock = (props: RenderOf<typeof accountingLedgerBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.ledger
    const period = bookPeriodOf(props.params.value(props.props.periodParam))
    const bandCells = (ledger: Ledger) =>
        bandOf(ledger, {
            opening: words({ key: "ledger_opening" }),
            income: words({ key: "ledger_in" }),
            expense: words({ key: "ledger_out" }),
            closing: words({ key: "ledger_closing" }),
        })
    const kindWord = (kind: string): string => words({ key: `kind_${kind}` })
    const columns: ReadonlyArray<TableColumnData> = [
        { id: "entry", label: words({ key: "ledger_col_entry" }) },
        { id: "income", label: words({ key: "ledger_in" }), numeric: true, priority: "low" },
        { id: "expense", label: words({ key: "ledger_out" }), numeric: true, priority: "low" },
        { id: "balance", label: words({ key: "ledger_col_balance" }), numeric: true },
    ]
    const head = {
        label: words(props.props.title),
        headingLevel: 3 as const,
        headers: [
            {
                kind: "switch" as const,
                ...periodSwitchOf(
                    {
                        label: words({ key: "ledger_period" }),
                        thisMonth: words({ key: "book_period_this" }),
                        lastMonth: words({ key: "book_period_last" }),
                    },
                    period,
                    (next) => props.params.set(props.props.periodParam, next === "last" ? "last" : null),
                ),
            },
        ],
    }
    return (
        <SlotView
            slot={parsedSlot(read.slot, ledgerRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            frame={surfaceFrame(head)}
            render={(ledger, isLoading) => (
                <Stack gap="section">
                    <SurfaceCard
                        kind="figures"
                        ariaLabel={words(props.props.title)}
                        isLoading={isLoading}
                        items={bandCells(ledger).map((cell) => ({ id: cell.id, term: cell.term, value: cell.value }))}
                    />
                    <SurfaceCard
                        kind="table"
                        {...head}
                        isLoading={isLoading}
                        columns={columns}
                        groups={groupsOf(sectionsOf(ledger, kindWord), words({ key: "ledger_day_balance" }))}
                        empty={<EmptyNotice message={labels.empty} />}
                    />
                </Stack>
            )}
        />
    )
}
