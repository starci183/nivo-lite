import type { PageHeaderContent } from "@starci/grammar/common"
import { TeamForbidden } from "@/components/blocks/TeamForbidden"
import { TeamIndividualNotice } from "@/components/blocks/TeamIndividualNotice"
import { TeamInvite } from "@/components/blocks/TeamInvite"
import { TeamInvites } from "@/components/blocks/TeamInvites"
import { TeamMembers } from "@/components/blocks/TeamMembers"
import { TeamPageFrame } from "@/components/blocks/TeamPageFrame"
import { PAGE_CLASS_NAME } from "./classNames"

/** The header the team page supplies. */
export interface TeamPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/**
 * Draws the team screen: heading and tabs, then the connected members, pending invitations and invite form (each reads the team from the
 * back end GraphQL API and draws only for an owner or a manager) and the notice staff see instead.
 */
export const TeamPageBase = (props: TeamPageBaseProps) => (
    <TeamPageFrame selected="members" header={props.props.header}>
        <div className={PAGE_CLASS_NAME}>
            <TeamForbidden />
            <TeamMembers />
            <TeamIndividualNotice />
            <TeamInvites />
            <TeamInvite />
        </div>
    </TeamPageFrame>
)
