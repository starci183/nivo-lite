import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, Link, Section } from "@starci/grammar/common"
import type { accountingDueSoonBlock } from "../blocks/due-soon.block"
import { dueRecord, dueRowsOf, type DueRecord } from "../../rules/overview-view"
import { parsedSlot } from "../../../../../shared/slots/slots"
import { useBlockWords, useSlotLabels } from "../../../../../shared/client/composites/useBlockWords"
import type { RenderOf } from "../../../../../shared/client/render-props"

/** The rows shown while the first read is in flight. */
const PLACEHOLDER: DueRecord = {
    rows: [{ id: "placeholder", kind: "vat", unit: "month", period: 1, dueDay: "2026-01-20", daysLeft: 1 }],
}

/** The tax declarations that fall due soon, and the notice that nothing else is listed until an invoice tool is connected. */
export const DueSoonBlock = (props: RenderOf<typeof accountingDueSoonBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.due
    return (
        <SlotView
            slot={parsedSlot(read.slot, dueRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(due, isLoading) => (
                <Section
                    kind="list"
                    title={`${words(props.props.title)} ${words(props.props.horizon)}`}
                    headingLevel={3}
                    caption={words(props.props.notice)}
                    action={
                        <Link variant="head" href={host.navigation.href(props.props.linkPath)}>
                            {words(props.props.linkLabel)}
                        </Link>
                    }
                    isLoading={isLoading}
                    items={dueRowsOf(due.rows, {
                        title: {
                            vatMonth: words({ key: "due_vat_month" }),
                            vatQuarter: words({ key: "due_vat_quarter" }),
                            pit: words({ key: "due_pit" }),
                        },
                        due: words({ key: "due_date" }),
                        left: words({ key: "due_left" }),
                        today: words({ key: "due_today" }),
                    }).map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        badges: [{ label: row.chip, tone: "warning" }],
                    }))}
                    empty={<EmptyNotice message={labels.empty} />}
                />
            )}
        />
    )
}
