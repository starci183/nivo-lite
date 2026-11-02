import { Stack, Page } from "@starci/grammar/common"

import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspaceJoin } from "@/components/blocks/WorkspaceJoin"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesCreate } from "@/components/blocks/WorkspacesCreate"
import { WorkspacesList } from "@/components/blocks/WorkspacesList"
import { WorkspacesOverview } from "@/components/blocks/WorkspacesOverview"
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

/** Draws the workspaces screen: the frame and the connected overview of the person's workspaces. */
export const WorkspacesPageBase = (props: WorkspacesPageBaseProps) => (
    <WorkspacesFrame
        mainLabel={props.props.title}
        logo={<BrandLogo href={AUTH_ROUTES.workspaces} variant="full" height={40} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <Page
            measure="product"
            header={{ title: props.props.title, description: props.props.description, actions: <WorkspacesCreate /> }}
        >
            <Stack gap="section">
                <WorkspacesOverview reason={props.props.reason} />
                <WorkspacesList />
                <WorkspaceJoin />
            </Stack>
        </Page>
    </WorkspacesFrame>
)
