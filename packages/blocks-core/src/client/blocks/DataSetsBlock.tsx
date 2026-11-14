import type { ReactNode } from "react"
import { useBlockHost } from "@nivo-lite/agent-sdk/client"
import { SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { dataSetPathOf, type dataSetsBlock } from "../../blocks/data-sets.block"
import { cellContextOf } from "../../rows/cell-format"
import { filledText, setCountIn, setCountOf } from "../../rows/desk-views"
import { figureTextOf } from "../../rows/figure-format"
import { valueAt } from "../../slots/paths"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * The data the agent works on: one row per set, its count from the ONE counts read (none drawn while it loads, when the read fails or
 * when the read does not hold it: never 0), and "open" to the set's own data page. The rows are the spec's, so the card never waits on
 * the read to draw them; a spec with no set draws no card.
 */
export const DataSetsBlock = (props: RenderOf<typeof dataSetsBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const block = props.props
    const counts = props.slots.counts.slot
    const record = "items" in counts ? counts.items : null
    const context = cellContextOf(host.locale(), undefined)
    if (block.items.length === 0) return null
    const items = block.items.map((item): ListRowData => {
        const count = record === null ? null : setCountIn(record, item)
        const hinted = record === null || item.hintPath === undefined ? null : setCountOf(valueAt(record, item.hintPath))
        return {
            id: item.set,
            title: words(item.label),
            ...(item.hint === undefined || hinted === null
                ? {}
                : { description: filledText(words(item.hint), { count: figureTextOf(hinted, "count", context) }) }),
            ...(count === null ? {} : { value: figureTextOf(count, "count", context) }),
            action: { label: words(block.openLabel), href: host.navigation.href(dataSetPathOf(item.set)), endArrow: true },
            actionPlacement: "end",
        }
    })
    return (
        <SurfaceCard
            label={words(block.label)}
            headingLevel={3}
            kind="list"
            items={items}
            empty={null}
        />
    )
}
