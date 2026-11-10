import type { ReactNode } from "react"
import { DescriptionList, Stack, Text } from "@starci/grammar/common"
import type { DescriptionListItem } from "@starci/grammar/common"
import { accountingReportKind } from "../../modules/accounting/agent-message-kinds"
import type { AccountingReportPayload } from "../../modules/accounting/agent-message-kinds"
import type { AgentMessageView } from "../agent-message/agent-message-views"

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
            {report.notes.map((note, index) => (
                // A note has no id of its own and two notes may read the same: the place keeps each key unique and stable.
                <Text key={`note-${String(index)}`} size="sm" tone="muted">
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
