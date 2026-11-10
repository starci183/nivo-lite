import { Button, Cluster, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { InviteLink } from "@/components/branches/InviteLink"
import type { InviteRowView, TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamInviteDetailCopy = TeamPanesBaseProps["props"]["copy"]["invite"]

/** What the opened invitation's pane draws and does. */
interface TeamInviteDetailProps {
    readonly view: InviteRowView
    readonly copy: TeamInviteDetailCopy
    readonly isLoading: boolean
    readonly onResend: () => void
    readonly onCopy: () => void
    readonly onRevoke: () => void
    readonly onLinkCopied: () => void
}

/** The invitation as rows of one list: the role it gives with its state, when it ends, and the staff row it is for. */
const rowsOf = (props: TeamInviteDetailProps): ReadonlyArray<ListRowData> => [
    {
        id: "role",
        title: props.copy.roleTerm,
        description: props.view.roleLabel,
        badges: [{ label: props.copy.stateLabel, tone: props.view.isExpired ? "warning" : "neutral" }],
    },
    { id: "expiry", title: props.copy.expiryTerm, description: props.view.expiry },
    ...(props.view.staffNote === undefined
        ? []
        : [{ id: "staff", title: props.copy.staffTerm, description: props.view.staffNote }]),
]

/**
 * The opened invitation as cards on the well: its facts with its state, the commands (send again, copy a new link, withdraw) and
 * the link once one was issued. Issuing a link replaces the old one, which the note under the commands says.
 */
export const TeamInviteDetail = (props: TeamInviteDetailProps) => (
    <>
        <SurfaceCard
            kind="list"
            ariaLabel={props.view.email}
            isLoading={props.isLoading}
            items={rowsOf(props)}
            empty={null}
        />
        <SurfaceCard ariaLabel={props.copy.resendLabel} isLoading={props.isLoading} note={props.copy.rotateNote}>
            <Cluster gap="inline">
                <Button intent="alternative" isPending={props.view.pendingAction === "resend"} onPress={props.onResend}>
                    {props.copy.resendLabel}
                </Button>
                <Button intent="alternative" isPending={props.view.pendingAction === "copy"} onPress={props.onCopy}>
                    {props.copy.copyLabel}
                </Button>
                <Button
                    intent="destructive"
                    step="entry"
                    isPending={props.view.pendingAction === "revoke"}
                    onPress={props.onRevoke}
                >
                    {props.copy.revokeLabel}
                </Button>
            </Cluster>
        </SurfaceCard>
        {props.view.link === undefined ? null : (
            <SurfaceCard ariaLabel={props.view.link.label}>
                <InviteLink
                    id="invite-detail-link"
                    label={props.view.link.label}
                    link={props.view.link.value}
                    copyLabel={props.copy.copyLabel}
                    copiedLabel={props.copy.copiedLabel}
                    note=""
                    isCopied={props.view.link.isCopied}
                    onCopy={props.onLinkCopied}
                />
            </SurfaceCard>
        )}
    </>
)
