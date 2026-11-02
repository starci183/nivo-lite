import { Stack } from "@starci/grammar/common"
import type { TeamPageHeading } from "@/modules/types"
import { PermissionRules } from "@/components/blocks/PermissionRules"
import { TeamPageFrame } from "@/components/blocks/TeamPageFrame"

/** The header the permissions page supplies. */
export interface PermissionsPageBaseProps {
    readonly props: {
        readonly heading: TeamPageHeading
    }
}

/** Draws the Quyen screen: heading and the tabs shared with the team page, then the rule table with its drawer. */
export const PermissionsPageBase = (props: PermissionsPageBaseProps) => (
    <TeamPageFrame selected="permissions" heading={props.props.heading}>
        <>
            <Stack gap="region">
                <PermissionRules />
            </Stack>
        </>
    </TeamPageFrame>
)
