import { Page } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspaceCreate } from "@/components/blocks/WorkspaceCreate"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"

/** Copy and values the new-workspace page supplies. */
export interface WorkspaceNewPageBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
    }
}

/** Draws the new-workspace screen: one Page: the heading and the form that names the workspace. */
export const WorkspaceNewPageBase = (props: WorkspaceNewPageBaseProps) => (
    <WorkspacesFrame
        homeHref={AUTH_ROUTES.workspaces}
        mainLabel={props.props.title}
        logo={<BrandLogo variant="full" height={44} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <Page measure="reading" header={{ title: props.props.title, description: props.props.description }}>
            <WorkspaceCreate />
        </Page>
    </WorkspacesFrame>
)
