import { EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import type { RunStepStatus, RunStepView } from "@/modules/types"

/** What the card of steps (a phone has it in place of the column) draws and what it does. */
interface AgentRunStepsCardProps {
    readonly props: {
        readonly title: string
        readonly empty: string
        readonly steps: ReadonlyArray<RunStepView>
        readonly isLoading: boolean
    }
    readonly on: {
        readonly select: (nodeKey: string) => void
    }
}

/** The glyph of each state of a step. */
const GLYPHS: Readonly<Record<RunStepStatus, IconName>> = {
    pending: "pending",
    running: "play",
    waiting: "handRaised",
    done: "complete",
    failed: "failure",
}

/** One step as a row: its state mark, its name (led by an arrow inside a group) and how long it took at the end. */
const rowOf = (step: RunStepView, select: (nodeKey: string) => void): ListRowData => ({
    id: step.id,
    title: step.isNested ? `↳ ${step.label}` : step.label,
    description: step.result,
    leading: { icon: nivoIconSource(GLYPHS[step.status], "leading") },
    onPress: () => select(step.id),
    ...(step.durationLabel === "" ? {} : { meta: { text: step.durationLabel } }),
})

/** The steps of a run as a card of rows, for the screen that has no column beside the main pane. */
export const AgentRunStepsCard = (props: AgentRunStepsCardProps) => (
    <SurfaceCard
        kind="list"
        label={props.props.title}
        headingLevel={2}
        isLoading={props.props.isLoading}
        items={props.props.steps.map((step) => rowOf(step, props.on.select))}
        empty={<EmptyNotice message={props.props.empty} iconSource={nivoIconSource("history", "leading")} />}
    />
)
