import { Grid, Stack, Page } from "@starci/grammar/common"

import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { PendingInvitesCard } from "@/components/blocks/PendingInvitesCard"
import { WorkspaceDeleteDialog } from "@/components/blocks/WorkspaceDeleteDialog"
import { WorkspaceJoin } from "@/components/blocks/WorkspaceJoin"
import { WorkspaceLeaveDialog } from "@/components/blocks/WorkspaceLeaveDialog"
import { WorkspaceLeaveOwnerDialog } from "@/components/blocks/WorkspaceLeaveOwnerDialog"
import { WorkspaceReasonDialog } from "@/components/blocks/WorkspaceReasonDialog"
import { WorkspaceRename } from "@/components/blocks/WorkspaceRename"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesCreate } from "@/components/blocks/WorkspacesCreate"
import { WorkspacesOverview } from "@/components/blocks/WorkspacesOverview"
import { WorkspacesStack } from "@/components/blocks/WorkspacesStack"
import { WorkspacesTable } from "@/components/blocks/WorkspacesTable"
import { WorkspacesFrame } from "@/components/frames/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"

/** Copy and values the workspaces page supplies. */
export interface WorkspacesPageBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        /** The reason the person landed here (`disabled`), from the URL. */
        readonly reason?: string | undefined
    }
}

/**
 * Draws the workspaces lobby: the frame, the person's workspaces (a table on a wide screen, stacked rows on a phone, or the first-run
 * welcome), and beside them the invitations waiting for the person and the way to join by link (on a phone the invitations come first).
 * The lobby's dialogs (rename, leave, last owner, delete, why access is off) open over the page from the row menus.
 */
export const WorkspacesPageBase = (props: WorkspacesPageBaseProps) => (
    <WorkspacesFrame
        mainLabel={props.props.title}
        logo={<BrandLogo href={AUTH_ROUTES.workspaces} variant="os" height={32} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <Page
            measure="product"
            header={{ breadcrumbs: "root", title: props.props.title, description: props.props.description, actions: <WorkspacesCreate /> }}
        >
            <Grid
                kind="main-rail"
                railWidth="medium"
                align="start"
                primary={
                    <Stack gap="section">
                        <WorkspacesOverview reason={props.props.reason} />
                        <PendingInvitesCard placement="main" />
                        <WorkspacesTable />
                        <WorkspacesStack />
                        <WorkspaceRename />
                        <WorkspaceLeaveDialog />
                        <WorkspaceLeaveOwnerDialog />
                        <WorkspaceDeleteDialog />
                        <WorkspaceReasonDialog />
                    </Stack>
                }
                rail={
                    <Stack gap="section">
                        <PendingInvitesCard placement="rail" />
                        <WorkspaceJoin />
                    </Stack>
                }
            />
        </Page>
    </WorkspacesFrame>
)
