import { Badge, Button, EmptyNotice, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import { InviteLink } from "@/components/composites/InviteLink"
import { TeamSection } from "@/components/composites/TeamSection"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import {
    ACTIONS_CLASS_NAME,
    FACTS_CLASS_NAME,
    IDENTITY_CLASS_NAME,
    IDENTITY_TEXT_CLASS_NAME,
    LINK_ROW_CLASS_NAME,
    ROW_CLASS_NAME,
} from "./classNames"

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
    readonly staffNote?: string
    readonly roleLabel: string
    readonly isExpired: boolean
    readonly isBusy: boolean
    readonly link?: LinkView
}

/** Copy, rows and state the connected invitations list supplies. */
export interface TeamInvitesBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly emptyLabel: string
        readonly failTitle: string
        readonly resendLabel: string
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly revokeLabel: string
        readonly rotateNote: string
        readonly rows: ReadonlyArray<InviteRowView>
        /** The invitations are loading: the heading stays, the list is skeleton rows. */
        readonly isSkeleton: boolean
        readonly error?: string
        readonly notice?: string
    }
    readonly on: {
        readonly resend: (id: string) => void
        readonly copyLink: (id: string) => void
        readonly revoke: (id: string) => void
        readonly linkCopied: () => void
    }
}

/** Draws the pending invitations with expiry, resend, copy link and revoke. */
export const TeamInvitesBase = (props: TeamInvitesBaseProps) => (
    <TeamSection
        id="team-invites-title"
        title={props.props.title}
        description={props.props.description}
        failTitle={props.props.failTitle}
        error={props.props.error}
    >
        {props.props.notice === undefined ? null : (
            <Text size="sm" live="polite">
                {props.props.notice}
            </Text>
        )}
        <SurfaceListCard
            ariaLabel={props.props.title}
            isLoading={props.props.isSkeleton}
            empty={<EmptyNotice message={props.props.emptyLabel} />}
        >
            {props.props.rows.map((row) => (
                <ListItem key={row.id} className={ROW_CLASS_NAME}>
                    <div className={IDENTITY_CLASS_NAME}>
                        <PersonAvatar name={row.email} size="md" />
                        <div className={IDENTITY_TEXT_CLASS_NAME}>
                            <Text weight="semibold" overflow="truncate">
                                {row.email}
                            </Text>
                            <Text size="sm" tone="muted">
                                {row.expiry}
                            </Text>
                            {row.staffNote === undefined ? null : (
                                <Text size="xs" tone="muted" overflow="truncate">
                                    {row.staffNote}
                                </Text>
                            )}
                        </div>
                    </div>
                    <div className={FACTS_CLASS_NAME}>
                        <Badge tone={row.isExpired ? "warning" : "accent"}>{row.roleLabel}</Badge>
                    </div>
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button variant="outline" isPending={row.isBusy} onPress={() => props.on.resend(row.id)}>
                            {props.props.resendLabel}
                        </Button>
                        <Button variant="outline" isPending={row.isBusy} onPress={() => props.on.copyLink(row.id)}>
                            {props.props.copyLabel}
                        </Button>
                        <Button variant="ghost" isPending={row.isBusy} onPress={() => props.on.revoke(row.id)}>
                            {props.props.revokeLabel}
                        </Button>
                    </div>
                    {row.link === undefined ? null : (
                        <div className={LINK_ROW_CLASS_NAME}>
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
                        </div>
                    )}
                </ListItem>
            ))}
        </SurfaceListCard>
    </TeamSection>
)
