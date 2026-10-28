import type { PageHeaderContent } from "@starci/grammar/common"
import { PermissionRules } from "@/components/blocks/PermissionRules"
import { TeamPageFrame } from "@/components/blocks/TeamPageFrame"
import { PAGE_CLASS_NAME } from "./classNames"

/** The header the permissions page supplies. */
export interface PermissionsPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the Quyen screen: heading and the tabs shared with the team page, then the rule table with its drawer. */
export const PermissionsPageBase = (props: PermissionsPageBaseProps) => (
    <TeamPageFrame selected="permissions" header={props.props.header}>
        <div className={PAGE_CLASS_NAME}>
            <PermissionRules />
        </div>
    </TeamPageFrame>
)
