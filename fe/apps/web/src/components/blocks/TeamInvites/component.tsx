import { AlertDialog, EmptyNotice, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { TeamInviteRowDetail } from "@/components/composites/TeamInviteRowDetail"

import { SlotView } from "@/components/composites/SlotView"

import type { DataSlot, InviteRowView, SlotLabels } from "@/modules/types"

/** Copy, rows and state the connected invitations list supplies. */
export interface TeamInvitesBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly resendLabel: string
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly revokeLabel: string
        readonly rotateNote: string
        /** The heading stays; the list is the slot of the rows. */
        readonly slot: DataSlot<ReadonlyArray<InviteRowView>>
        readonly placeholder: ReadonlyArray<InviteRowView>
        readonly slotLabels: SlotLabels
        readonly notice?: string
        readonly cancelLabel: string
        readonly confirm?: { readonly email: string; readonly isPending: boolean } | undefined
    }
    readonly on: {
        readonly retry: () => void
        readonly resend: (id: string) => void
        readonly copyLink: (id: string) => void
        readonly revoke: (id: string) => void
        readonly linkCopied: () => void
        readonly confirmRevoke: () => void
        readonly cancelRevoke: () => void
    }
}

/** The confirmation before an invitation is revoked; nothing is drawn while none waits. */
const RevokeDialog = (props: TeamInvitesBaseProps) =>
    props.props.confirm === undefined ? null : (
        <AlertDialog
            isOpen
            title={props.props.revokeLabel}
            description={props.props.confirm.email}
            tone="negative"
            confirmLabel={props.props.revokeLabel}
            cancelLabel={props.props.cancelLabel}
            isConfirmPending={props.props.confirm.isPending}
            onOpenChange={(open) => {
                if (!open) props.on.cancelRevoke()
            }}
            onConfirm={props.on.confirmRevoke}
            onCancel={props.on.cancelRevoke}
        />
    )

/** Draws the pending invitations with expiry, resend, copy link and revoke. */
export const TeamInvitesBase = (props: TeamInvitesBaseProps) => {
    const labels = {
        resend: props.props.resendLabel,
        copy: props.props.copyLabel,
        copied: props.props.copiedLabel,
        revoke: props.props.revokeLabel,
        rotateNote: props.props.rotateNote,
    }
    return (
        <div id="team-invites-title">
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <SurfaceCard
                        kind="bands"
                        label={props.props.title}
                        headingLevel={2}
                        isLoading={isLoading}
                        bands={[
                            {
                                kind: "body",
                                children: (
                                    <Stack gap="inline">
                                        <Text size="sm" tone="muted">
                                            {props.props.description}
                                        </Text>
                                        {props.props.notice === undefined ? null : (
                                            <Text size="sm" live="polite">
                                                {props.props.notice}
                                            </Text>
                                        )}
                                    </Stack>
                                ),
                            },
                            {
                                kind: "list",
                                empty: <EmptyNotice message={props.props.slotLabels.empty} />,
                                items: rows.map((row): ListRowData => ({
                                    id: row.id,
                                    title: row.email,
                                    description: row.expiry,
                                    leading: { avatar: { name: row.email } },
                                    badges: [{ label: row.roleLabel, tone: row.isExpired ? "warning" : "accent" }],
                                    detail: (
                                        <TeamInviteRowDetail
                                            row={row}
                                            isLoading={isLoading}
                                            labels={labels}
                                            onResend={props.on.resend}
                                            onCopyLink={props.on.copyLink}
                                            onRevoke={props.on.revoke}
                                            onLinkCopied={props.on.linkCopied}
                                        />
                                    ),
                                })),
                            },
                        ]}
                    />
                )}
            />
            <RevokeDialog {...props} />
        </div>
    )
}
