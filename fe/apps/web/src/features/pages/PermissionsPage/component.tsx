import { PageContainer } from "@starci/grammar/common"
import { PermissionRules } from "@/components/blocks/PermissionRules"
import { TeamTabs } from "@/components/blocks/TeamTabs"
import { HomePageHeading } from "@/components/composites/HomePageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

/** Copy the permissions page supplies. */
export interface PermissionsPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/** Draws the Quyen screen: heading, the tabs shared with the team page, then the rule table with its drawer. */
export const PermissionsPageBase = (props: PermissionsPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <HomePageHeading {...props.props} />
            <TeamTabs selected="permissions" />
            <PermissionRules />
        </div>
    </PageContainer>
)
