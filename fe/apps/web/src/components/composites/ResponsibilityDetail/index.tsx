import { Badge, Cluster, DescriptionList, Link, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"
import type { ResponsibilitiesBoardCopy, ResponsibilityRowView } from "@/modules/types"

/** The words of the responsibility detail. */
type ResponsibilityDetailCopy = ResponsibilitiesBoardCopy["detail"]

/** What the opened responsibility draws below its head. */
interface ResponsibilityDetailProps {
    readonly row: ResponsibilityRowView
    readonly copy: ResponsibilityDetailCopy
    /** The owner's picture, or none (an agent without one draws the NIVO unicorn). */
    readonly avatarUrl: string | null
    /** "Agent AI @handle" or the human owner's role. */
    readonly ownerRole: string
    /** The due day as a date, or none. */
    readonly dueDate: string | null
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

/** The due words, strong when it is overdue, with the day beside them. */
const DueValue = (props: Pick<ResponsibilityDetailProps, "row" | "dueDate">) => (
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
    const { row, copy } = props
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
                                description: (
                                    <OwnerValue row={row} role={props.ownerRole} avatarUrl={props.avatarUrl} />
                                ),
                            },
                            {
                                id: "due",
                                term: copy.terms.due,
                                description: <DueValue row={row} dueDate={props.dueDate} />,
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
                <Link href={leadHref(row.leadId)}>{copy.openLead}</Link>
                <Link href={CONSOLE_ROUTES.chat}>{copy.openOffice}</Link>
                {props.isCopied ? (
                    <Text size="sm" tone="muted" live="polite">
                        {copy.linkCopied}
                    </Text>
                ) : null}
            </Cluster>
        </Stack>
    )
}
