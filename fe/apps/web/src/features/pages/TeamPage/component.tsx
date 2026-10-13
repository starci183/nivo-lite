import { PageContainer } from "@starci/grammar/common"
import { TeamForbidden } from "@/components/blocks/TeamForbidden"
import { TeamInvite } from "@/components/blocks/TeamInvite"
import { TeamInvites } from "@/components/blocks/TeamInvites"
import { TeamMembers } from "@/components/blocks/TeamMembers"
import { HomePageHeading } from "@/components/composites/HomePageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

/** Copy the team page supplies. */
export interface TeamPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/**
 * Draws the team screen: heading, then the connected members, pending invitations and invite form (each reads the team from the
 * back end GraphQL API and draws only for an owner or a manager) and the notice staff see instead.
 */
export const TeamPageBase = (props: TeamPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <HomePageHeading {...props.props} />
            <TeamForbidden />
            <TeamMembers />
            <TeamInvites />
            <TeamInvite />
        </div>
    </PageContainer>
)
