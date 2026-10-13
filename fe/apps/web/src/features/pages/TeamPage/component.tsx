import { PageContainer, SectionHeader, Text, TextAction } from "@starci/grammar/common"
import { TeamInvite } from "@/components/blocks/TeamInvite"
import { TeamInvites } from "@/components/blocks/TeamInvites"
import { TeamMembers } from "@/components/blocks/TeamMembers"
import { PageHeading } from "@/components/composites/PageHeading"
import type { TeamInviteView, TeamMemberView, StaffChoiceView, TeamRole } from "@/hooks/team"
import { PAGE_CLASS_NAME } from "./classNames"

/** The friendly 403 a staff member sees instead of the team. */
interface ForbiddenView {
    readonly eyebrow: string
    readonly title: string
    readonly body: string
    readonly backLabel: string
    readonly backHref: string
}

/** Copy and values the team page supplies. */
export interface TeamPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly workspaceId: string
        readonly selfId: string
        readonly selfRole: TeamRole
        readonly members: ReadonlyArray<TeamMemberView>
        readonly invites: ReadonlyArray<TeamInviteView>
        readonly staffChoices: ReadonlyArray<StaffChoiceView>
        /** The same page while its data loads: headings and labels stay, members and invitations are skeleton rows. */
        readonly isLoading: boolean
        /** Set for a person who may not see the team; the page then draws only this notice. */
        readonly forbidden?: ForbiddenView
    }
}

/** Draws the team screen: members, pending invitations and the invite form, or the notice that only owners and managers see it. */
export const TeamPageBase = (props: TeamPageBaseProps) => {
    const forbidden = props.props.forbidden
    if (forbidden !== undefined) {
        return (
            <PageContainer measure="product">
                <div className={PAGE_CLASS_NAME}>
                    <SectionHeader
                        level={1}
                        eyebrow={forbidden.eyebrow}
                        title={forbidden.title}
                        description={forbidden.body}
                    />
                    <Text>
                        <TextAction href={forbidden.backHref}>{forbidden.backLabel}</TextAction>
                    </Text>
                </div>
            </PageContainer>
        )
    }
    return (
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                <PageHeading
                    crumbLabel={props.props.crumbLabel}
                    crumbs={[
                        { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
                        { id: "team", label: props.props.title },
                    ]}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.description}
                />
                <TeamMembers
                    workspaceId={props.props.workspaceId}
                    selfId={props.props.selfId}
                    selfRole={props.props.selfRole}
                    members={props.props.members}
                    isLoading={props.props.isLoading}
                />
                <TeamInvites
                    workspaceId={props.props.workspaceId}
                    invites={props.props.invites}
                    isLoading={props.props.isLoading}
                />
                <TeamInvite
                    workspaceId={props.props.workspaceId}
                    staffChoices={props.props.staffChoices}
                    isLoading={props.props.isLoading}
                />
            </div>
        </PageContainer>
    )
}
