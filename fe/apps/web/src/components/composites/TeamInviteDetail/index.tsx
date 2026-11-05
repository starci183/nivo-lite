import { Badge, Button, Cluster, DescriptionList, Stack, Text } from "@starci/grammar/common"
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

/** The facts of an invitation: the role it gives, when it ends, and the staff row it is for. */
const factsOf = (props: TeamInviteDetailProps) => [
    { id: "role", term: props.copy.roleTerm, description: props.view.roleLabel },
    { id: "expiry", term: props.copy.expiryTerm, description: props.view.expiry },
    ...(props.view.staffNote === undefined
        ? []
        : [{ id: "staff", term: props.copy.staffTerm, description: props.view.staffNote }]),
]

/**
 * The opened invitation: its state, its facts, the commands (send again, copy a new link, withdraw) and the link once one was
 * issued. Issuing a link replaces the old one, which the note says.
 */
export const TeamInviteDetail = (props: TeamInviteDetailProps) => (
    <>
        <Badge tone={props.view.isExpired ? "warning" : "neutral"} isLoading={props.isLoading}>
            {props.copy.stateLabel}
        </Badge>
        <DescriptionList items={factsOf(props)} isLoading={props.isLoading} />
        <Stack gap="row">
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
            <Text size="sm" tone="muted">
                {props.copy.rotateNote}
            </Text>
            {props.view.link === undefined ? null : (
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
            )}
        </Stack>
    </>
)
