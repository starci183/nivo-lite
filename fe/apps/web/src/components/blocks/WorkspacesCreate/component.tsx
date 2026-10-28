import { Button } from "@starci/grammar/common"
import { APP_ROUTES } from "@/modules/routes"

/** The words of the create action. */
export interface WorkspacesCreateBaseProps {
    readonly props: { readonly label: string }
}

/** Draws the way to create another workspace, as the action of the workspaces page header. */
export const WorkspacesCreateBase = (props: WorkspacesCreateBaseProps) => (
    <Button intent="commit" href={APP_ROUTES.workspaceNew}>
        {props.props.label}
    </Button>
)
