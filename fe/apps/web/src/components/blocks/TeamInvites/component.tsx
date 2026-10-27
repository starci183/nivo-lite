import { Badge, Button, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { InviteLink } from "@/components/composites/InviteLink"
import { TeamSection } from "@/components/composites/TeamSection"
import { SlotView } from "@/components/composites/SlotView"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, DETAIL_CLASS_NAME } from "./classNames"

/** The link just issued for a row. */
interface LinkView {
    readonly label: string
    readonly value: string
    readonly isCopied: boolean
}

/** One pending invitation, already worded for the person's language. */
export interface InviteRowView {
    readonly id: string
    readonly email: string
    readonly expiry: string
    readonly staffNote?: string | undefined
    readonly roleLabel: string
    readonly isExpired: boolean
    readonly isBusy: boolean
    readonly link?: LinkView | undefined
}

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
    }
    readonly on: {
        readonly retry: () => void
        readonly resend: (id: string) => void
        readonly copyLink: (id: string) => void
        readonly revoke: (id: string) => void
        readonly linkCopied: () => void
    }
}

/** Draws the pending invitations with expiry, resend, copy link and revoke. */
export const TeamInvitesBase = (props: TeamInvitesBaseProps) => (
    <TeamSection id="team-invites-title" title={props.props.title} description={props.props.description}>
        {props.props.notice === undefined ? null : (
            <Text size="sm" live="polite">
                {props.props.notice}
            </Text>
        )}
        <SurfaceListCard ariaLabel={props.props.title}>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
            >
                {(rows, isSkeleton) => (
                    <>
                        {rows.map((row) => (
                            <ListRow
                                key={row.id}
                                isSkeleton={isSkeleton}
                                leading={<PersonAvatar name={row.email} size="md" />}
                                title={row.email}
                                description={row.expiry}
                                badges={<Badge tone={row.isExpired ? "warning" : "accent"}>{row.roleLabel}</Badge>}
                                actions={
                                    <div className={ACTIONS_CLASS_NAME}>
                                        <Button
                                            intent="neutral"
                                            isPending={row.isBusy}
                                            onPress={() => props.on.resend(row.id)}
                                        >
                                            {props.props.resendLabel}
                                        </Button>
                                        <Button
                                            intent="neutral"
                                            isPending={row.isBusy}
                                            onPress={() => props.on.copyLink(row.id)}
                                        >
                                            {props.props.copyLabel}
                                        </Button>
                                        <Button
                                            intent="destructive"
                                            step="entry"
                                            isPending={row.isBusy}
                                            onPress={() => props.on.revoke(row.id)}
                                        >
                                            {props.props.revokeLabel}
                                        </Button>
                                    </div>
                                }
                            >
                                {row.staffNote === undefined && row.link === undefined ? null : (
                                    <div className={DETAIL_CLASS_NAME}>
                                        {row.staffNote === undefined ? null : (
                                            <Text size="xs" tone="muted" overflow="truncate">
                                                {row.staffNote}
                                            </Text>
                                        )}
                                        {row.link === undefined ? null : (
                                            <InviteLink
                                                id={`invite-link-${row.id}`}
                                                label={row.link.label}
                                                link={row.link.value}
                                                copyLabel={props.props.copyLabel}
                                                copiedLabel={props.props.copiedLabel}
                                                note={props.props.rotateNote}
                                                isCopied={row.link.isCopied}
                                                onCopy={props.on.linkCopied}
                                            />
                                        )}
                                    </div>
                                )}
                            </ListRow>
                        ))}
                    </>
                )}
            </SlotView>
        </SurfaceListCard>
    </TeamSection>
)

/** State values and commands consumed by the connected surface. */
export interface Shown {
    readonly id: string
    readonly email: string
    readonly link: string
    readonly isCopied: boolean
}
