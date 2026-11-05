import { Page, Pane, PaneGrid, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AskPassages } from "@/components/composites/AskPassages"
import { AskQuestionForm } from "@/components/frames/AskQuestionForm"
import { AskSeesTable } from "@/components/composites/AskSeesTable"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { KnowledgeDocMark } from "@/components/composites/KnowledgeDocMark"
import { PaneHead } from "@/components/composites/PaneHead"
import { PaneBody } from "@/components/frames/PaneBody"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AskSeesView, BrainAskView } from "@/modules/types"

/** A comparison of the same shape as a ready one: the customer and an agent against four kinds of knowledge. */
const SEES_PLACEHOLDER: AskSeesView = {
    audiences: [
        { id: "customer", name: "-" },
        { id: "agent", name: "-" },
    ],
    lanes: ["a", "b", "c", "d"].map((id) => ({ id, label: "-", cells: {} })),
}

/** The side pane: its head, then what the customer and the chosen agent each see. */
const SeesPane = (props: BrainAskBaseProps) => {
    const view = props.props
    return (
        <>
            <PaneHead
                title={view.copy.seesTitle}
                headingLevel={2}
                description={view.seesLine}
                isLoading={view.isWaiting}
            />
            <PaneBody isWaiting={view.isWaiting}>
                <SlotView
                    slot={view.sees}
                    placeholder={SEES_PLACEHOLDER}
                    labels={view.seesLabels}
                    onRetry={props.on.retry}
                    render={(sees, isLoading) => (
                        <AskSeesTable
                            sees={sees}
                            copy={view.copy}
                            isLoading={isLoading}
                            emptyLabel={view.seesLabels.empty}
                        />
                    )}
                />
                <Text size="xs" tone="muted" isLoading={view.isWaiting}>
                    {view.copy.seesHint}
                </Text>
            </PaneBody>
        </>
    )
}

/** The words, values and commands the connected try-it screen supplies. */
export interface BrainAskBaseProps {
    readonly props: BrainAskView["props"]
    readonly on: BrainAskView["on"]
}

/**
 * Draws the try-it screen of the Second Brain as the page of its tab: the header with its tab strip, then the question (the agent to
 * ask as, who is asking, what the agent would read for it) beside a compact table of what the customer and that agent see. A phone
 * shows the question, and the table behind the details control of its head. Every region draws its skeleton at once while the agents load.
 */
export const BrainAskBase = (props: BrainAskBaseProps) => {
    const view = props.props
    const grid = view.grid
    return (
        <Page
            chrome="panes"
            header={{
                ...view.header.heading,
                actions: (
                    <BrainHeaderActions review={view.header.actions.review} add={null} onReview={props.on.reviewAll} />
                ),
                tabs: brainHeaderTabs({ tabs: view.header.tabs, onSelect: props.on.selectTab }),
            }}
            measure="product"
        >
            <PaneGrid
                label={view.copy.grid}
                role="tabpanel"
                id={view.panelId}
                areas={grid.areas}
                columns={grid.columns}
                rows={grid.rows}
            >
                <Pane area="head" surface>
                    <PaneHead
                        title={view.copy.headTitle}
                        headingLevel={1}
                        description={view.copy.headLine}
                        mark={<KnowledgeDocMark glyph="search" />}
                        drawerOpener={{
                            pane: "aside",
                            icon: nivoIconSource("info", "leading"),
                            label: view.copy.seesTitle,
                        }}
                        isLoading={view.isWaiting}
                    />
                </Pane>
                <Pane area="main" scroll label={view.copy.headTitle}>
                    <PaneBody isWaiting={view.isWaiting}>
                        <AskQuestionForm props={view} on={props.on} />
                        {view.results === null ? null : <AskPassages passages={view.results} copy={view.copy} />}
                    </PaneBody>
                </Pane>
                <Pane
                    area="aside"
                    surface
                    scroll
                    label={view.copy.seesTitle}
                    collapse="drawer"
                    trigger="head"
                    collapseLabel={view.copy.seesTitle}
                    closeLabel={view.copy.closeAside}
                >
                    <SeesPane {...props} />
                </Pane>
            </PaneGrid>
        </Page>
    )
}
