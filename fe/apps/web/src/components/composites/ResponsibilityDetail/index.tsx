import { Badge, Cluster, DescriptionList, Link, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ResponsibilitiesBoardCopy, ResponsibilityOpenedView, ResponsibilityRowView } from "@/modules/types"

/** The words of the responsibility detail. */
type ResponsibilityDetailCopy = ResponsibilitiesBoardCopy["detail"]

/** What the opened responsibility draws below its head. */
interface ResponsibilityDetailProps {
    /** The responsibility with its owner's picture and role, its due day and the addresses of its customer and of the Office. */
    readonly opened: ResponsibilityOpenedView
    readonly copy: ResponsibilityDetailCopy
    /** The link of the customer was just copied. */
    readonly isCopied: boolean
    readonly isLoading: boolean
}

/** What the owner value draws. */
interface OwnerValueProps {
    readonly row: ResponsibilityRowView
    readonly role: string
    readonly avatarUrl: string | null
}

/** The owner: their mark, their name and their role. */
const OwnerValue = (props: OwnerValueProps) => (
    <Cluster gap="inline">
        {props.row.ownerKind === "agent" ? (
            <AgentMark label={props.row.ownerName} seed={props.row.ownerKey} src={props.avatarUrl} size="sm" />
        ) : (
            <PersonAvatar name={props.row.ownerName} size="xs" />
        )}
        <Text as="span">{props.row.ownerName}</Text>
        <Text as="span" size="sm" tone="muted">
            {`· ${props.role}`}
        </Text>
    </Cluster>
)

/** What the due value draws. */
interface DueValueProps {
    readonly row: ResponsibilityRowView
    readonly dueDate: string | null
}

/** The due words, strong when it is overdue, with the day beside them. */
const DueValue = (props: DueValueProps) => (
    <Cluster gap="inline">
        <Text as="span" isStrong={props.row.isOverdue} tone={props.row.isOverdue ? "default" : "muted"}>
            {props.row.dueLabel ?? ""}
        </Text>
        {props.dueDate === null ? null : (
            <Text as="span" size="sm" tone="muted">
                {`· ${props.dueDate}`}
            </Text>
        )}
    </Cluster>
)

/** The responsibility's facts, the note when a draft waits for the owner, and the two ways to the customer. */
export const ResponsibilityDetail = (props: ResponsibilityDetailProps) => {
    const { copy } = props
    const { row, avatarUrl, ownerRole, dueDate, leadHref, officeHref } = props.opened
    return (
        <Stack gap="section">
            <SurfaceCard label={copy.title} fact={copy.verified} isLoading={props.isLoading}>
                <Stack gap="row">
                    <DescriptionList
                        isLoading={props.isLoading}
                        items={[
                            {
                                id: "owner",
                                term: copy.terms.owner,
                                description: <OwnerValue row={row} role={ownerRole} avatarUrl={avatarUrl} />,
                            },
                            {
                                id: "due",
                                term: copy.terms.due,
                                description: <DueValue row={row} dueDate={dueDate} />,
                            },
                            { id: "next", term: copy.terms.next, description: row.nextAction },
                            {
                                id: "status",
                                term: copy.terms.status,
                                description: (
                                    <Badge tone={row.status === "waiting_approval" ? "warning" : "neutral"} isDot>
                                        {row.statusLabel}
                                    </Badge>
                                ),
                            },
                        ]}
                    />
                    {row.status === "waiting_approval" && row.ownerKind === "agent" ? (
                        <Text size="sm">{copy.draftNote(row.ownerName)}</Text>
                    ) : null}
                </Stack>
            </SurfaceCard>
            <Cluster gap="row">
                <Link href={leadHref}>{copy.openLead}</Link>
                <Link href={officeHref}>{copy.openOffice}</Link>
                {props.isCopied ? (
                    <Text size="sm" tone="muted" live="polite">
                        {copy.linkCopied}
                    </Text>
                ) : null}
            </Cluster>
        </Stack>
    )
}
