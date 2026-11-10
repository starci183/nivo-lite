import { WorkspaceRenameDialog } from "@/components/composites/WorkspaceRenameDialog"
import type { WorkspaceRenameView } from "@/modules/types"

/** The rename step of the lobby: the view and the callbacks of its dialog. */
export interface WorkspaceRenameBaseProps {
    readonly props: WorkspaceRenameView
    readonly on: {
        readonly change: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** Draws the lobby's rename step as the small rename dialog. */
export const WorkspaceRenameBase = (props: WorkspaceRenameBaseProps) => (
    <WorkspaceRenameDialog props={props.props} on={props.on} />
)
