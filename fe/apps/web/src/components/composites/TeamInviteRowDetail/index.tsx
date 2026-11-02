import { Button, Cluster, Stack, Text } from "@starci/grammar/common"
import { InviteLink } from "@/components/branches/InviteLink"

/** Resolved actions and link feedback of one invitation, without its collection identity. */
interface TeamInviteRowDetailProps {
    readonly row: {
        readonly id: string
        readonly isBusy: boolean
        readonly pendingAction: "resend" | "copy" | "revoke" | null
        readonly staffNote?: string | undefined
        readonly link?: { readonly label: string; readonly value: string; readonly isCopied: boolean } | undefined
    }
    readonly labels: {
        readonly resend: string
        readonly copy: string
        readonly copied: string
        readonly revoke: string
        readonly rotateNote: string
    }
    readonly isLoading: boolean
    readonly onResend: (id: string) => void
    readonly onCopyLink: (id: string) => void
    readonly onRevoke: (id: string) => void
    readonly onLinkCopied: () => void
}

/** Draws the original three controls, optional staff note and newly issued link in the existing row detail. */
export const TeamInviteRowDetail = (props: TeamInviteRowDetailProps) => (
    <Stack gap="inline">
        <Cluster gap="inline">
            <Button
                intent="neutral"
                size="sm"
                isLoading={props.isLoading}
                isPending={props.row.pendingAction === "resend"}
                isDisabled={props.row.isBusy}
                onPress={() => props.onResend(props.row.id)}
            >
                {props.labels.resend}
            </Button>
            <Button
                intent="neutral"
                size="sm"
                isLoading={props.isLoading}
                isPending={props.row.pendingAction === "copy"}
                isDisabled={props.row.isBusy}
                onPress={() => props.onCopyLink(props.row.id)}
            >
                {props.labels.copy}
            </Button>
            <Button
                intent="destructive"
                step="entry"
                size="sm"
                isLoading={props.isLoading}
                isDisabled={props.row.isBusy}
                onPress={() => props.onRevoke(props.row.id)}
            >
                {props.labels.revoke}
            </Button>
        </Cluster>
        {props.row.staffNote === undefined ? null : (
            <Text size="xs" tone="muted" isLoading={props.isLoading} overflow="truncate">
                {props.row.staffNote}
            </Text>
        )}
        {props.row.link === undefined ? null : (
            <InviteLink
                id={"invite-link-" + props.row.id}
                label={props.row.link.label}
                link={props.row.link.value}
                copyLabel={props.labels.copy}
                copiedLabel={props.labels.copied}
                note={props.labels.rotateNote}
                isCopied={props.row.link.isCopied}
                onCopy={props.onLinkCopied}
            />
        )}
    </Stack>
)
