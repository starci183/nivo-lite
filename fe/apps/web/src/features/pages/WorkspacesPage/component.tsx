import { Page } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspaceJoin } from "@/components/blocks/WorkspaceJoin"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesCreate } from "@/components/blocks/WorkspacesCreate"
import { WorkspacesList } from "@/components/blocks/WorkspacesList"
import { WorkspacesOverview } from "@/components/blocks/WorkspacesOverview"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"
import { STACK_CLASS_NAME } from "./classNames"

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
        homeHref={AUTH_ROUTES.workspaces}
        mainLabel={props.props.title}
        logo={<BrandLogo variant="full" height={44} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <Page
            measure="product"
            header={{ title: props.props.title, description: props.props.description, actions: <WorkspacesCreate /> }}
        >
            <div className={STACK_CLASS_NAME}>
                <WorkspacesOverview reason={props.props.reason} />
                <WorkspacesList />
                <WorkspaceJoin />
            </div>
        </Page>
    </WorkspacesFrame>
)
