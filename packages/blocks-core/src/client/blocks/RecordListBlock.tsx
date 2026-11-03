import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { recordListBlock } from "../../blocks/record-list.block"
import { RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf } from "../../rows/rows"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A card listing bound records, with an optional action on each row. */
export const RecordListBlock = (props: RenderOf<typeof recordListBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.rows
    const open = props.slots.open
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) => rowsOf(records, props.props))
    const openRow = (id: string): void => {
        open.run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={RECORD_ROWS_PLACEHOLDER}
            onRetry={read.retry}
            render={(items, isLoading) => (
                <SurfaceCard
                    kind="list"
                    label={words(props.props.label)}
                    headingLevel={2}
                    isLoading={isLoading}
                    items={items.map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        ...(row.badge === "" ? {} : { badges: [{ label: row.badge, tone: "neutral" as const }] }),
                        ...(open.isAllowed ? { action: { label: open.label, press: () => openRow(row.id) } } : {}),
                    }))}
                    empty={<EmptyNotice message={labels.empty} />}
                />
            )}
        />
    )
}
