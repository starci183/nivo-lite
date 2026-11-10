import { Button, Cluster, Section } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { PendingInviteView } from "@/modules/types"

/** Copy and rows the connected pending-invitations card supplies. */
export interface PendingInvitesCardBaseProps {
    readonly props: {
        readonly label: string
        readonly acceptLabel: string
        readonly declineLabel: string
        readonly invites: ReadonlyArray<PendingInviteView>
        /** The id of the invitation being acted on: its buttons show the loading state. */
        readonly pendingId?: string | undefined
        /** The line under each workspace name, by invitation id: who invites, in which role, and for how long. */
        readonly lines: Readonly<Record<string, string>>
    }
    readonly on: {
        readonly accept: (id: string) => void
        readonly decline: (id: string) => void
    }
}

/** The two commands of one invitation, under its copy. */
const actionsOf = (props: PendingInvitesCardBaseProps, invite: PendingInviteView) => {
    const isPending = props.props.pendingId === invite.id
    return (
        <Cluster gap="row">
            <Button intent="commit" isPending={isPending} onPress={() => props.on.accept(invite.id)}>
                {props.props.acceptLabel}
            </Button>
            <Button intent="alternative" isDisabled={isPending} onPress={() => props.on.decline(invite.id)}>
                {props.props.declineLabel}
            </Button>
        </Cluster>
    )
}

/** One invitation row: the mark, the workspace, who invites in which role and for how long, and the two commands. */
const rowOf = (props: PendingInvitesCardBaseProps, invite: PendingInviteView): ListRowData => ({
    id: invite.id,
    title: invite.workspaceName,
    description: props.props.lines[invite.id] ?? "",
    leading: { avatar: { name: invite.workspaceName } },
    detail: actionsOf(props, invite),
})

/** Draws the invitations waiting for this account as one list card with their count; nothing when there are none. */
export const PendingInvitesCardBase = (props: PendingInvitesCardBaseProps) => {
    if (props.props.invites.length === 0) return null
    return (
        <Section
            kind="list"
            title={props.props.label}
            headingLevel={2}
            fact={String(props.props.invites.length)}
            items={props.props.invites.map((invite) => rowOf(props, invite))}
            empty={null}
        />
    )
}
