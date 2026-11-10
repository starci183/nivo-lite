import { AdminSupportActions } from "@/components/blocks/AdminSupportActions"
import { AdminWorkspaceScreen } from "@/components/blocks/AdminWorkspaceScreen"

/** The workspace the overview page was opened for. */
export interface AdminWorkspacePageBaseProps {
    readonly props: {
        readonly workspaceId: string
    }
}

/** Draws the /admin/[id] screen: the connected workspace screen, with the support actions drawer composed into it. */
export const AdminWorkspacePageBase = (props: AdminWorkspacePageBaseProps) => (
    <AdminWorkspaceScreen workspaceId={props.props.workspaceId}>
        <AdminSupportActions workspaceId={props.props.workspaceId} />
    </AdminWorkspaceScreen>
)
