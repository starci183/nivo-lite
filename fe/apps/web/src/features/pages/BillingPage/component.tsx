import { BillingOverview } from "@/components/blocks/BillingOverview"
import { BillingCreditPacks } from "@/components/blocks/BillingCreditPacks"
import { BillingPlans } from "@/components/blocks/BillingPlans"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"

/** What the billing page is told: the workspace it bills, its words and the two links. */
export interface BillingPageBaseProps {
    readonly props: {
        readonly workspaceId: string
        readonly mainLabel: string
        readonly homeHref: string
        readonly contactHref: string
    }
}

/** Draws the billing screen: the overview, the plans and the credit packs inside the workspaces frame. */
export const BillingPageBase = (props: BillingPageBaseProps) => (
    <WorkspacesFrame
        homeHref={props.props.homeHref}
        mainLabel={props.props.mainLabel}
        logo={<BrandLogo variant="full" height={44} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <BillingOverview workspaceId={props.props.workspaceId} />
        <BillingPlans workspaceId={props.props.workspaceId} contactHref={props.props.contactHref} />
        <BillingCreditPacks workspaceId={props.props.workspaceId} />
    </WorkspacesFrame>
)
