import { EmptyNotice, FlowGraph, Section, Stack, Text, type BadgeTone, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkflowDiffView, WorkflowMark } from "@/modules/types"

/** The words of the body of the diff drawer. */
export interface AgentWorkflowDiffCopy {
    readonly stepsTitle: string
    readonly stepsEmpty: string
    readonly otherTitle: string
    readonly mapTitle: string
    readonly mapLabel: string
    readonly mapCaption: string
    readonly keepCaption: string
    readonly keptTitle: string
}

/** What the body of the diff draws. */
interface AgentWorkflowDiffProps {
    readonly props: {
        readonly copy: AgentWorkflowDiffCopy
        readonly view: WorkflowDiffView
    }
}

const MARK_TONES: Readonly<Record<WorkflowMark, BadgeTone>> = { added: "success", removed: "danger", changed: "warning" }

/**
 * What the drawer of a diff holds: the steps added, removed and changed (each with what changed in it), the other changes, the steps
 * where the owner's side stays, and the map with the changed steps painted and the others faded. It stands on the drawer, so no card.
 */
export const AgentWorkflowDiff = (props: AgentWorkflowDiffProps) => {
    const { copy, view } = props.props
    const rows: ReadonlyArray<ListRowData> = view.steps.map((step) => ({
        id: step.key,
        title: step.title,
        description: step.description,
        badges: [{ label: step.markLabel, tone: MARK_TONES[step.mark], isDot: true }],
    }))
    return (
        <Stack gap="section">
            <Section
                kind="list"
                title={copy.stepsTitle}
                headingLevel={3}
                items={rows}
                empty={<EmptyNotice message={copy.stepsEmpty} iconSource={nivoIconSource("saved", "leading")} />}
            />
            {view.kept === "" ? null : (
                <Section title={copy.keptTitle} headingLevel={3} caption={copy.keepCaption}>
                    <Text>{view.kept}</Text>
                </Section>
            )}
            {view.lines.length === 0 ? null : (
                <Section title={copy.otherTitle} headingLevel={3}>
                    <Stack gap="identity">
                        {view.lines.map((line) => (
                            <Text key={line}>{line}</Text>
                        ))}
                    </Stack>
                </Section>
            )}
            <Section title={copy.mapTitle} headingLevel={3} caption={copy.mapCaption}>
                <FlowGraph
                    label={copy.mapLabel}
                    nodes={view.flow.nodes}
                    edges={view.flow.edges}
                    layout="steps"
                    statusLabels={view.flow.statusLabels}
                    isInteractive={false}
                    fit="contain"
                    height="lg"
                />
            </Section>
        </Stack>
    )
}
