import { Button, Page } from "@starci/grammar/common"
import { AdminSupportActions } from "@/components/blocks/AdminSupportActions"
import { AdminWorkspaceLists } from "@/components/blocks/AdminWorkspaceLists"
import { AdminWorkspaceName } from "@/components/blocks/AdminWorkspaceName"
import { AdminWorkspaceOverview } from "@/components/blocks/AdminWorkspaceOverview"
import { AdminWorkspaceSummary } from "@/components/blocks/AdminWorkspaceSummary"
import { ADMIN_ROUTES } from "@/modules/routes"
import { PAGE_CLASS_NAME } from "./classNames"

/** The workspace the overview page was opened for, and the words around it. */
export interface AdminWorkspacePageBaseProps {
    readonly props: {
        readonly workspaceId: string
        readonly eyebrow: string
        readonly allWorkspacesLabel: string
    }
}

/** Draws the /admin/[id] screen: the header band of the workspace, then the overview, the confirmed support actions and the lists. */
export const AdminWorkspacePageBase = (props: AdminWorkspacePageBaseProps) => (
    <Page
        measure="full"
        header={{
            meta: props.props.eyebrow,
            title: <AdminWorkspaceName workspaceId={props.props.workspaceId} />,
            description: <AdminWorkspaceSummary workspaceId={props.props.workspaceId} />,
            actions: (
                <Button intent="neutral" href={ADMIN_ROUTES.workspaces}>
                    {props.props.allWorkspacesLabel}
                </Button>
            ),
        }}
    >
        <div className={PAGE_CLASS_NAME}>
            <AdminWorkspaceOverview workspaceId={props.props.workspaceId} />
            <AdminSupportActions workspaceId={props.props.workspaceId} />
            <AdminWorkspaceLists workspaceId={props.props.workspaceId} />
        </div>
    </Page>
)
