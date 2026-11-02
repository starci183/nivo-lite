import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacePayment } from "@/components/blocks/WorkspacePayment"
import { WorkspacesFrame } from "@/components/frames/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"

/** Static copy and URL selectors supplied by the payment shell. */
export interface WorkspacePaymentPageBaseProps {
    readonly props: {
        readonly title: string
        readonly workspaceId?: string | undefined
        readonly orderId?: string | undefined
        readonly renewing: boolean
    }
}

/** The payment step in the shared workspaces frame. */
export const WorkspacePaymentPageBase = (props: WorkspacePaymentPageBaseProps) => (
    <WorkspacesFrame
        mainLabel={props.props.title}
        logo={<BrandLogo variant="full" height={40} href={AUTH_ROUTES.workspaces} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <WorkspacePayment
            workspaceId={props.props.workspaceId}
            orderId={props.props.orderId}
            renewing={props.props.renewing}
        />
    </WorkspacesFrame>
)
