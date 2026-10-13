import { AdminSupportActions } from "@/components/blocks/AdminSupportActions"
import { AdminWorkspaceLists } from "@/components/blocks/AdminWorkspaceLists"
import { AdminWorkspaceOverview } from "@/components/blocks/AdminWorkspaceOverview"

/** The workspace the overview page was opened for. */
export interface AdminWorkspacePageBaseProps {
    readonly props: {
        readonly workspaceId: string
    }
}

/** Draws the /admin/[id] screen body: the overview, the confirmed support actions and the lists of one workspace. */
export const AdminWorkspacePageBase = (props: AdminWorkspacePageBaseProps) => (
    <>
        <AdminWorkspaceOverview workspaceId={props.props.workspaceId} />
        <AdminSupportActions workspaceId={props.props.workspaceId} />
        <AdminWorkspaceLists workspaceId={props.props.workspaceId} />
    </>
)
