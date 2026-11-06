import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Cluster, DataTable, EmptyNotice, Heading, Section, Stack, Text } from "@starci/grammar/common"
import type { accountingLedgerBlock } from "../../blocks/accounting/ledger.block"
import { bookPeriodOf } from "../../rules/accounting/book-view"
import type { Ledger } from "../../rules/accounting/ledger"
import { bandOf, ledgerCardOf, ledgerRecord, sectionsOf } from "../../rules/accounting/ledger-view"
import type { LedgerCardWords, LedgerRow, LedgerSection } from "../../rules/accounting/ledger-view"
import { parsedSlot } from "../../slots/slots"
import { PeriodControl } from "./PeriodControl"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useIsPhone } from "../composites/useIsPhone"
import type { RenderOf } from "../render-props"

const COLUMNS = ["entry", "income", "expense", "balance"] as const

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

/** What the cell of one column of a line takes. */
interface LineCellProps {
    readonly row: LedgerRow
    readonly column: (typeof COLUMNS)[number]
}

/** One cell of a line: what it is, the money in, the money out or the balance after it. */
const LineCell = (props: LineCellProps): ReactNode => {
    switch (props.column) {
        case "entry":
            return <>{props.row.title}</>
        case "income":
            return <>{props.row.income}</>
        case "expense":
            return <>{props.row.expense}</>
        case "balance":
            return <>{props.row.balance}</>
    }
}

/** What the lines of one day take. */
interface DayProps {
    readonly section: LedgerSection
    readonly columnLabels: Readonly<Record<(typeof COLUMNS)[number], string>>
    readonly closingLabel: string
    readonly empty: string
    readonly isLoading: boolean
    readonly isPhone: boolean
    readonly cardWords: LedgerCardWords
}

/** One day: its date and closing balance over the lines of the day. */
const Day = (props: DayProps): ReactNode => (
    <Stack gap="row">
        <Cluster gap="inline" justify="between" align="center">
            <Heading level={4}>{props.section.day}</Heading>
            <Text size="sm" tone="muted">{`${props.closingLabel} ${props.section.balance}`}</Text>
        </Cluster>
        {props.isPhone ? (
            <Section
                kind="list"
                ariaLabel={props.section.day}
                isLoading={props.isLoading}
                items={props.section.rows
                    .map((row) => ledgerCardOf(row, props.cardWords))
                    .map((card) => ({
                        id: card.id,
                        title: card.title,
                        ...(card.description === "" ? {} : { description: card.description }),
                        meta: { text: card.balance },
                    }))}
                empty={<EmptyNotice message={props.empty} />}
            />
        ) : (
            <DataTable
                label={props.section.day}
                columns={COLUMNS.map((column, index) => ({
                    id: column,
                    label: props.columnLabels[column],
                    isRowHeader: index === 0,
                    align: column === "entry" ? "start" : "end",
                }))}
                rows={props.section.rows}
                renderCell={(row, column) => (
                    <LineCell row={row} column={COLUMNS.find((candidate) => candidate === column) ?? "entry"} />
                )}
                isLoading={props.isLoading}
                emptyContent={<EmptyNotice message={props.empty} />}
            />
        )}
    </Stack>
)

/** The cash book of the period: the band of balances, then each day with its lines. */
export const LedgerBlock = (props: RenderOf<typeof accountingLedgerBlock>): ReactNode => {
    const words = useBlockWords()
    const isPhone = useIsPhone()
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
    const columnLabels = {
        entry: words({ key: "ledger_col_entry" }),
        income: words({ key: "ledger_in" }),
        expense: words({ key: "ledger_out" }),
        balance: words({ key: "ledger_col_balance" }),
    }
    const cardWords: LedgerCardWords = { income: words({ key: "ledger_in" }), expense: words({ key: "ledger_out" }) }
    return (
        <Stack gap="row">
            <Cluster gap="inline" justify="between" align="center">
                <Heading level={3}>{words(props.props.title)}</Heading>
                <PeriodControl
                    period={period}
                    onChange={(next) => props.params.set(props.props.periodParam, next === "last" ? "last" : null)}
                />
            </Cluster>
            <SlotView
                slot={parsedSlot(read.slot, ledgerRecord)}
                labels={labels}
                placeholder={PLACEHOLDER}
                onRetry={read.retry}
                render={(ledger, isLoading) => (
                    <Stack gap="section">
                        {isPhone ? (
                            <Section
                                kind="list"
                                ariaLabel={words(props.props.title)}
                                isLoading={isLoading}
                                items={bandCells(ledger).map((cell) => ({
                                    id: cell.id,
                                    title: cell.term,
                                    meta: { text: cell.value },
                                }))}
                                empty={<EmptyNotice message={labels.empty} />}
                            />
                        ) : (
                            <Section
                                kind="figures"
                                ariaLabel={words(props.props.title)}
                                isLoading={isLoading}
                                items={bandCells(ledger).map((cell) => ({
                                    id: cell.id,
                                    term: cell.term,
                                    value: cell.value,
                                }))}
                            />
                        )}
                        {sectionsOf(ledger, kindWord).map((section) => (
                            <Day
                                key={section.day}
                                section={section}
                                columnLabels={columnLabels}
                                closingLabel={words({ key: "ledger_day_balance" })}
                                empty={labels.empty}
                                isLoading={isLoading}
                                isPhone={isPhone}
                                cardWords={cardWords}
                            />
                        ))}
                    </Stack>
                )}
            />
        </Stack>
    )
}
