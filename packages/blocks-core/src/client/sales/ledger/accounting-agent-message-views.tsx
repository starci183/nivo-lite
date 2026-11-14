import type { ReactNode } from "react"
import { DescriptionList, Stack, Text, type DescriptionListItem } from "@starci/grammar/common"
import { accountingReportKind, type AccountingReportPayload } from "../../../modules/sales/ledger/agent-message-kinds"
import type { AgentMessageView } from "../../agent-message/agent-message-views"

/** The figures of a report as key/value rows: each figure strong. */
const figureItemsOf = (payload: AccountingReportPayload): ReadonlyArray<DescriptionListItem> =>
    payload.rows.map((row, index) => ({
        id: `row-${String(index)}`,
        term: row.label,
        description: (
            <Text size="sm" isStrong>
                {row.value}
            </Text>
        ),
    }))

/** The credits behind a difference: why, the amount, and the bank reference with the day under it. */
const differenceItemsOf = (payload: AccountingReportPayload): ReadonlyArray<DescriptionListItem> =>
    payload.differences.map((difference, index) => ({
        id: `difference-${String(index)}`,
        term: difference.label,
        description: (
            <Stack gap="identity">
                <Text size="sm" isStrong>
                    {difference.value}
                </Text>
                <Text size="sm" tone="muted">
                    {difference.detail}
                </Text>
            </Stack>
        ),
    }))

/** A note with the key it renders under. */
interface KeyedNote {
    key: string
    note: string
}

/** A note has no id of its own and two notes may read the same: the key is the note and its turn among the notes that read alike. */
const keyedNotesOf = (notes: ReadonlyArray<string>): Array<KeyedNote> => {
    const turns = new Map<string, number>()
    return notes.map((note) => {
        const turn = (turns.get(note) ?? 0) + 1
        turns.set(note, turn)
        return { key: `${note}#${String(turn)}`, note }
    })
}

/** The evening report or the month-end reconciliation: the figures, then the credits behind a difference, then the guidance lines. */
const reportPreview = (payload: unknown): ReactNode => {
    const parsed = accountingReportKind.payload.safeParse(payload)
    if (!parsed.success) return null
    const report = parsed.data
    return (
        <Stack gap="row">
            <DescriptionList layout="columns" isDivided={false} items={figureItemsOf(report)} />
            {report.differences.length === 0 ? null : (
                <DescriptionList layout="columns" isDivided={false} items={differenceItemsOf(report)} />
            )}
            {keyedNotesOf(report.notes).map(({ key, note }) => (
                <Text key={key} size="sm" tone="muted">
                    {note}
                </Text>
            ))}
        </Stack>
    )
}

/** The views of the kinds the accounting flows register. */
export const accountingAgentMessageViews: ReadonlyArray<AgentMessageView> = [
    { kind: accountingReportKind, preview: reportPreview },
]
