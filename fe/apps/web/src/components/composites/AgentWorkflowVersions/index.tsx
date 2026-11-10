import { EmptyNotice, SurfaceCard, TextAction, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkflowVersionRowView } from "@/modules/types"

/** The words of the history of versions. */
export interface AgentWorkflowVersionsCopy {
    readonly title: string
    readonly caption: string
    readonly empty: string
    readonly active: string
    readonly rollback: string
    readonly viewDiff: string
}

/** What the history draws and what it does. */
interface AgentWorkflowVersionsProps {
    readonly props: {
        readonly copy: AgentWorkflowVersionsCopy
        readonly versions: ReadonlyArray<WorkflowVersionRowView>
        readonly isLoading: boolean
    }
    readonly on: {
        readonly rollback: (number: number) => void
        readonly diff: (number: number) => void
    }
}

/** One version: its number and where it came from, who made it and why, "Running" on the current one, the way back on the others. */
const rowOf = (props: AgentWorkflowVersionsProps, version: WorkflowVersionRowView): ListRowData => ({
    id: String(version.number),
    title: version.title,
    description: version.description,
    detail: <TextAction onPress={() => props.on.diff(version.number)}>{props.props.copy.viewDiff}</TextAction>,
    ...(version.isActive
        ? { badges: [{ label: props.props.copy.active, tone: "success" as const, isDot: true }] as const }
        : {
              action: { label: props.props.copy.rollback, press: () => props.on.rollback(version.number) },
              actionPlacement: "end" as const,
          }),
})

/** "Version history": one list card of the versions, newest first, the title above the card and the caption below. */
export const AgentWorkflowVersions = (props: AgentWorkflowVersionsProps) => (
    <SurfaceCard
        kind="list"
        label={props.props.copy.title}
        headingLevel={2}
        note={props.props.copy.caption}
        isLoading={props.props.isLoading}
        empty={<EmptyNotice message={props.props.copy.empty} iconSource={nivoIconSource("saved", "leading")} />}
        items={props.props.versions.map((version) => rowOf(props, version))}
    />
)
