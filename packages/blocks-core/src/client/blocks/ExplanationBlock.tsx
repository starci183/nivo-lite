import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { explanationBlock } from "../../blocks/explanation.block"
import { parsedSlot, rowsSlot } from "../../slots/slots"
import { ITEMS_REGION_PLACEHOLDER, WHY_PLACEHOLDER } from "../../views/placeholders"
import { itemsRegionView, whyView } from "../../views/views"
import { ExplanationFrame } from "../composites/ExplanationFrame"
import { PaneRows } from "../composites/PaneRows"
import { WhyPanel } from "../composites/WhyPanel"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The explanation shape: what waits and what was done on the left, the why pane of the open item beside it. */
export const ExplanationBlock = (props: RenderOf<typeof explanationBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const whyLabels = useSlotLabels(props.props.missingTitle)
    const { why, waiting, done, close } = props.slots
    const closeWhy = (): void => {
        close.run({ id: "" }).catch(() => host.notify("danger", labels.error))
    }
    return (
        <ExplanationFrame
            label={words(props.props.label)}
            listLabel={words(props.props.listLabel)}
            openLabel={words(props.props.openLabel)}
            closeLabel={words(props.props.closeLabel)}
            onClose={closeWhy}
            list={
                <>
                    <SlotView
                        slot={rowsSlot(parsedSlot(waiting.slot, itemsRegionView))}
                        labels={labels}
                        placeholder={ITEMS_REGION_PLACEHOLDER}
                        empty="collapse"
                        forbidden="hide"
                        onRetry={waiting.retry}
                        render={(view, isLoading) => (
                            <PaneRows
                                label={words(props.props.waitingLabel)}
                                rows={view.rows}
                                openLabel={view.linkLabel}
                                isLoading={isLoading}
                            />
                        )}
                    />
                    <SlotView
                        slot={rowsSlot(parsedSlot(done.slot, itemsRegionView))}
                        labels={labels}
                        placeholder={ITEMS_REGION_PLACEHOLDER}
                        empty="collapse"
                        forbidden="hide"
                        onRetry={done.retry}
                        render={(view, isLoading) => (
                            <PaneRows
                                label={words(props.props.doneLabel)}
                                rows={view.rows}
                                openLabel={null}
                                isLoading={isLoading}
                            />
                        )}
                    />
                </>
            }
            why={
                <SlotView
                    slot={parsedSlot(why.slot, whyView)}
                    labels={whyLabels}
                    placeholder={WHY_PLACEHOLDER}
                    emptyDescription={words(props.props.missingBody)}
                    onRetry={why.retry}
                    render={(view, isLoading) => (
                        <WhyPanel
                            view={view}
                            isLoading={isLoading}
                            words={{
                                pathLabel: words(props.props.pathLabel),
                                factsLabel: words(props.props.factsLabel),
                                sourcesLabel: words(props.props.sourcesLabel),
                                approverLabel: words(props.props.approverLabel),
                                timeLabel: words(props.props.timeLabel),
                                openOnMap: words(props.props.openOnMap),
                            }}
                        />
                    )}
                />
            }
        />
    )
}
