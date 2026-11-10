import { Drawer } from "@starci/grammar/common"
import { AgentWorkflowDiff } from "@/components/composites/AgentWorkflowDiff"
import type { AgentWorkflowDiffCopy } from "@/components/composites/AgentWorkflowDiff"
import type { WorkflowDiffReadView } from "@/modules/types"

/** What the diff drawer draws and what it does. */
interface AgentWorkflowDiffDrawerProps {
    readonly props: {
        readonly copy: AgentWorkflowDiffCopy
        readonly closeLabel: string
        readonly diff: WorkflowDiffReadView
        readonly isOpen: boolean
        readonly isLoading: boolean
    }
    readonly on: { readonly close: () => void }
}

/** The drawer of a diff: the steps added, removed and changed against the version before or the newer template, and the map painted by them. */
export const AgentWorkflowDiffDrawer = (props: AgentWorkflowDiffDrawerProps) => (
    <Drawer
        title={props.props.diff.title}
        isOpen={props.props.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        closeLabel={props.props.closeLabel}
        width="wide"
        isLoading={props.props.isLoading}
    >
        <AgentWorkflowDiff props={{ copy: props.props.copy, view: props.props.diff.view }} />
    </Drawer>
)
