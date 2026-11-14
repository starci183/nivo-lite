import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Link, SurfaceCard, type BadgeTone, type ListRowData } from "@starci/grammar/common"
import type { reachCardBlock } from "../../blocks/reach-card.block"
import { REACH_PLACEHOLDER, reachRowsOf, reachView, type ReachRow } from "../../rows/desk-views"
import { parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The tone of a chip: an account that needs the owner in the warning tone, everything else neutral; never a dot (no live status). */
const toneOf = (chip: ReachRow["chip"]): BadgeTone => (chip === "attention" ? "warning" : "neutral")

/**
 * What the agent may touch, for any agent and any provider: its accounts with their state, then what it does by itself, asks first and
 * never does, each a row of the operation titles with the mode as a chip; the head links to the agent's rights. While it loads the head
 * stays real; with nothing attached it says so inside the card.
 */
export const ReachCardBlock = (props: RenderOf<typeof reachCardBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.reach
    const block = props.props
    const label = words(block.label)
    const chipWords: Readonly<Record<ReachRow["chip"], string>> = {
        connected: words(block.states.connected),
        attention: words(block.states.attention),
        off: words(block.states.off),
        auto: words(block.modes.auto),
        ask: words(block.modes.ask),
        none: words(block.modes.none),
    }
    const head = {
        label,
        headingLevel: 3 as const,
        labelEnd: (
            <Link href={host.navigation.href(block.linkPath)} variant="head">
                {words(block.linkLabel)}
            </Link>
        ),
    }
    const rowOf = (row: ReachRow): ListRowData => ({
        id: row.id,
        title: row.title,
        ...(row.description === undefined ? {} : { description: row.description }),
        badges: [{ label: chipWords[row.chip], tone: toneOf(row.chip) }],
    })
    return (
        <SlotView
            slot={parsedSlot(read.slot, reachView)}
            labels={labels}
            placeholder={REACH_PLACEHOLDER}
            onRetry={read.retry}
            frame={(notice) => <SurfaceCard {...head}>{notice}</SurfaceCard>}
            render={(reach, isLoading) => (
                <SurfaceCard
                    {...head}
                    kind="list"
                    isLoading={isLoading}
                    items={reachRowsOf(reach).map((item) => rowOf(item))}
                    empty={labels.empty}
                />
            )}
        />
    )
}
