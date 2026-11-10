import { Grid, Page, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AskPassages } from "@/components/composites/AskPassages"
import { AskQuestionForm } from "@/components/frames/AskQuestionForm"
import { AskSeesTable } from "@/components/composites/AskSeesTable"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import type { AskSeesView, BrainAskView } from "@/modules/types"

/** A comparison of the same shape as a ready one: the customer and an agent against four kinds of knowledge. */
const SEES_PLACEHOLDER: AskSeesView = {
    audiences: [
        { id: "customer", name: "-" },
        { id: "agent", name: "-" },
    ],
    lanes: ["a", "b", "c", "d"].map((id) => ({ id, label: "-", cells: {} })),
}

/** The side section: what the customer and the chosen agent each see; the table is the only surface, one caption below says who is compared. */
const SeesCard = (props: BrainAskBaseProps) => {
    const view = props.props
    return (
        <Section title={view.copy.seesTitle} caption={view.copy.seesHint} isLoading={view.isWaiting}>
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
        </Section>
    )
}

/** The main column: the question form in its card, then the passages found. */
const Question = (props: BrainAskBaseProps) => {
    const view = props.props
    return (
        <Stack gap="section">
            <SurfaceCard label={view.copy.headTitle} headingLevel={2} isLoading={view.isWaiting}>
                <Stack gap="row">
                    <Text size="xs" tone="muted" isLoading={view.isWaiting}>
                        {view.copy.headLine}
                    </Text>
                    <AskQuestionForm props={view} on={props.on} />
                </Stack>
            </SurfaceCard>
            {view.results === null ? null : <AskPassages passages={view.results} copy={view.copy} />}
        </Stack>
    )
}

/** The words, values and commands the connected try-it screen supplies. */
export interface BrainAskBaseProps {
    readonly props: BrainAskView["props"]
    readonly on: BrainAskView["on"]
}

/**
 * Draws the try-it screen of the Second Brain as the page of its tab: the header with its tab strip, then the question (the agent to
 * ask as, who is asking, what the agent would read for it) in the page measure of the other tabs, beside a card with a compact table of
 * what the customer and that agent see. Every region draws its skeleton at once while the agents load.
 */
export const BrainAskBase = (props: BrainAskBaseProps) => {
    const view = props.props
    return (
        <Page
            header={{
                ...view.header.heading,
                actions: (
                    <BrainHeaderActions review={view.header.actions.review} add={null} onReview={props.on.reviewAll} />
                ),
                tabs: brainHeaderTabs({ tabs: view.header.tabs, onSelect: props.on.selectTab }),
            }}
            measure="product"
        >
            <Grid
                kind="main-rail"
                railWidth="medium"
                align="start"
                primary={<Question {...props} />}
                rail={<SeesCard {...props} />}
            />
        </Page>
    )
}
