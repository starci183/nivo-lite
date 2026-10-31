import { AgentGraphDetail } from "@/components/branches/AgentGraphDetail"
import { AgentGraphEditor } from "@/components/branches/AgentGraphEditor"
import { AgentGraphProposals } from "@/components/branches/AgentGraphProposals"
import { AgentGraphRun } from "@/components/branches/AgentGraphRun"
import { AgentGraphVersions } from "@/components/branches/AgentGraphVersions"
import type { AgentGraphAction, AgentGraphPanelView, AgentGraphSideTab } from "@/modules/types"

/** The graph view, the tab that shows and the commands of the panes. */
interface AgentGraphInspectorProps {
    readonly view: AgentGraphPanelView
    readonly sideTab: AgentGraphSideTab
    readonly isSkeleton: boolean
    readonly onAction: (action: AgentGraphAction) => void
}

/**
 * What the pane beside the graph shows for a tab that is not the chat: the proposals, the versions, or, on Detail, the form of a
 * branch being edited, the run being traced, or the seven answers of the selected node.
 */
export const AgentGraphInspector = (props: AgentGraphInspectorProps) => {
    const { view, onAction } = props
    if (props.sideTab === "proposals") {
        return (
            <AgentGraphProposals
                view={view.proposals}
                isSkeleton={props.isSkeleton}
                onDecide={(value, isConfirmed) => onAction({ kind: "decide", value, isConfirmed })}
            />
        )
    }
    if (props.sideTab === "versions") {
        return (
            <AgentGraphVersions
                view={view.versions}
                isSkeleton={props.isSkeleton}
                onRestore={(value) => onAction({ kind: "restore", value })}
                onMode={(value) => onAction({ kind: "mode", value })}
            />
        )
    }
    if (view.inspector === "editor" && view.editor !== null) {
        return (
            <AgentGraphEditor
                view={view.editor}
                isSkeleton={props.isSkeleton}
                onField={(name, value) => onAction({ kind: "field", name, value })}
                onSave={() => onAction({ kind: "save" })}
                onCancel={() => onAction({ kind: "cancel" })}
            />
        )
    }
    if (view.inspector === "run" && view.run !== null) {
        return (
            <AgentGraphRun view={view.run} isSkeleton={props.isSkeleton} onBack={() => onAction({ kind: "untrace" })} />
        )
    }
    return (
        <AgentGraphDetail
            view={view.detail}
            isSkeleton={props.isSkeleton}
            onEdit={() => onAction({ kind: "edit" })}
            onRuns={() => onAction({ kind: "trace" })}
        />
    )
}
