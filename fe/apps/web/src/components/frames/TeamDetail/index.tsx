import { TeamInviteDetail } from "@/components/composites/TeamInviteDetail"
import { TeamMemberDetail } from "@/components/composites/TeamMemberDetail"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]

/** What the opened record's pane draws and does. */
interface TeamDetailProps {
    readonly copy: TeamPanesBaseProps["props"]["copy"]
    readonly data: TeamPanesData
    readonly selectedId: string | null
    readonly isMemberPending: boolean
    readonly isLoading: boolean
    readonly on: Pick<
        TeamPanesBaseProps["on"],
        "setRole" | "enable" | "askDisable" | "askRemove" | "resend" | "copyLink" | "askRevoke" | "linkCopied"
    >
}

/** The opened record: the person with their role and access commands, or the invitation with its commands and link. */
export const TeamDetail = (props: TeamDetailProps) => {
    const member = props.data.members.find((entry) => `member:${entry.id}` === props.selectedId)
    const invite = props.data.invites.find((entry) => `invite:${entry.id}` === props.selectedId)
    if (member !== undefined) {
        return (
            <TeamMemberDetail
                view={member}
                copy={props.copy.member}
                isPending={props.isMemberPending}
                isLoading={props.isLoading}
                onRole={(role) => props.on.setRole(member.id, role)}
                onEnable={() => props.on.enable(member.id)}
                onDisable={() => props.on.askDisable(member.id)}
                onRemove={() => props.on.askRemove(member.id)}
            />
        )
    }
    if (invite === undefined) return null
    return (
        <TeamInviteDetail
            view={invite}
            copy={props.copy.invite}
            isLoading={props.isLoading}
            onResend={() => props.on.resend(invite.id)}
            onCopy={() => props.on.copyLink(invite.id)}
            onRevoke={() => props.on.askRevoke(invite.id)}
            onLinkCopied={props.on.linkCopied}
        />
    )
}
