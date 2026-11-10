import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Grid, Stack } from "@starci/grammar/common"
import type { dashboardCardsBlock } from "../../blocks/dashboard-cards.block"
import { derivedSlot, parsedSlot, rowsSlot } from "../../slots/slots"
import {
    CONNECTIONS_REGION_PLACEHOLDER,
    ITEMS_REGION_PLACEHOLDER,
    KNOWLEDGE_GAPS_PLACEHOLDER,
    KNOWLEDGE_REGION_PLACEHOLDER,
} from "../../views/placeholders"
import { connectionsRegionView, itemsRegionView, knowledgeRegionView } from "../../views/views"
import { ConnectionsRegion } from "../composites/ConnectionsRegion"
import { DoneRegion } from "../composites/DoneRegion"
import { KnowledgeGapsCard } from "../composites/KnowledgeGapsCard"
import { KnowledgeRegion } from "../composites/KnowledgeRegion"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the agent finished, the connections it acts through and what it knows: one card each, each failing and retrying on its own. */
export const DashboardCardsBlock = (props: RenderOf<typeof dashboardCardsBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const knowledge = parsedSlot(props.slots.knowledge.slot, knowledgeRegionView)
    const done = props.slots.done
    const doneLabel = props.props.doneLabel
    const isSection = props.props.surface === "section"
    const cards = (
        <>
            {doneLabel === undefined || isSection ? null : (
                <SlotView
                    slot={rowsSlot(parsedSlot(done.slot, itemsRegionView))}
                    labels={labels}
                    placeholder={ITEMS_REGION_PLACEHOLDER}
                    onRetry={done.retry}
                    render={(view, isLoading) => (
                        <DoneRegion
                            label={words(doneLabel)}
                            emptyMessage={labels.empty}
                            view={view}
                            isLoading={isLoading}
                        />
                    )}
                />
            )}
            <SlotView
                slot={rowsSlot(parsedSlot(props.slots.connections.slot, connectionsRegionView))}
                labels={labels}
                placeholder={CONNECTIONS_REGION_PLACEHOLDER}
                empty="collapse"
                onRetry={props.slots.connections.retry}
                render={(view, isLoading) => (
                    <ConnectionsRegion
                        label={words(props.props.connectionsLabel)}
                        emptyMessage={labels.empty}
                        view={view}
                        isLoading={isLoading}
                        isSection={isSection}
                    />
                )}
            />
            <SlotView
                slot={knowledge}
                labels={labels}
                placeholder={KNOWLEDGE_REGION_PLACEHOLDER}
                onRetry={props.slots.knowledge.retry}
                render={(view, isLoading) => (
                    <KnowledgeRegion
                        label={words(props.props.knowledgeLabel)}
                        view={view}
                        isLoading={isLoading}
                        isSection={isSection}
                    />
                )}
            />
            {isSection ? null : (
                <SlotView
                    slot={derivedSlot(knowledge, (view) =>
                        view.gaps === null || view.gaps.rows.length === 0 ? null : view.gaps,
                    )}
                    labels={labels}
                    placeholder={KNOWLEDGE_GAPS_PLACEHOLDER}
                    empty="collapse"
                    forbidden="hide"
                    onRetry={props.slots.knowledge.retry}
                    render={(gaps, isLoading) => (
                        <KnowledgeGapsCard emptyMessage={labels.empty} view={gaps} isLoading={isLoading} />
                    )}
                />
            )}
        </>
    )
    return props.props.layout === "stack" ? (
        <Stack gap="region">{cards}</Stack>
    ) : (
        <Grid kind="cards" columns={3}>
            {cards}
        </Grid>
    )
}
