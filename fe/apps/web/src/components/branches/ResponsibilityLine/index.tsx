import { Badge, Button, DropdownMenu, IconTile, ListRow, Text } from "@starci/grammar/common"
import type { BadgeTone, DropdownMenuEntry } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import type { ResponsibilityRowView } from "@/modules/types"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"
import { ACTIONS_CLASS, META_CLASS } from "./classNames"

const STATUS_TONES: Record<ResponsibilityRowView["status"], BadgeTone> = {
    open: "neutral",
    waiting_approval: "accent",
    done: "success",
}

const STATUS_ICONS: Record<ResponsibilityRowView["status"], IconName> = {
    open: "pending",
    waiting_approval: "review",
    done: "complete",
}

/** The words of one row. */
export interface ResponsibilityRowLabels {
    readonly owner: string
    readonly next: (action: string) => string
    readonly open: string
    readonly more: string
    readonly drafting: string
    readonly aiDraft: string
    readonly linkCopied: string
    readonly menuOpenLead: string
    readonly menuOffice: string
    readonly menuCopy: string
    readonly menuDraft: string
    readonly menuDraftAgent: (name: string) => string
    readonly menuDraftHuman: string
}

/** Props for ResponsibilityLine. */
type ResponsibilityLineProps = {
    readonly row: ResponsibilityRowView
    readonly labels: ResponsibilityRowLabels
    readonly isDrafting: boolean
    readonly isCopied: boolean
    /** The row is drawn from the placeholder while its read is in flight. */
    readonly isSkeleton?: boolean
    readonly onDraft: (responsibilityId: string) => void
    readonly onCopy: (responsibilityId: string, leadId: string) => void
}

/** The actions menu of a row: open the lead, open the Office, copy the link and, while open, draft a follow-up. */
const entriesOf = (props: ResponsibilityLineProps): Array<DropdownMenuEntry> => {
    const { row, labels } = props
    const entries: Array<DropdownMenuEntry> = [
        {
            id: "open",
            label: labels.menuOpenLead,
            href: leadHref(row.leadId),
            iconSource: nivoIconSource("next", "leading"),
        },
        {
            id: "office",
            label: labels.menuOffice,
            href: CONSOLE_ROUTES.chat,
            iconSource: nivoIconSource("community", "leading"),
        },
        {
            id: "copy",
            label: labels.menuCopy,
            iconSource: nivoIconSource("saved", "leading"),
            onAction: () => props.onCopy(row.id, row.leadId),
        },
    ]
    if (row.status !== "open") return entries
    const who = row.ownerKind === "agent" ? labels.menuDraftAgent(row.ownerName) : labels.menuDraftHuman
    entries.push({
        kind: "section",
        id: "act",
        items: [
            {
                id: "draft",
                label: labels.menuDraft,
                description: who,
                iconSource: nivoIconSource("send", "leading"),
                onAction: () => props.onDraft(row.id),
            },
        ],
    })
    return entries
}

/** One responsibility as a card row: tile, title with status, customer, owner and due, Open and a real actions menu. */
export const ResponsibilityLine = (props: ResponsibilityLineProps) => {
    const { row, labels } = props
    return (
        <ListRow
            isSkeleton={props.isSkeleton ?? false}
            leading={
                <IconTile
                    source={nivoIconSource(STATUS_ICONS[row.status], "leading")}
                    tone={row.isOverdue ? "warning" : "accent"}
                    size="md"
                />
            }
            title={row.title}
            description={row.customer}
            badges={
                <>
                    <Badge tone={STATUS_TONES[row.status]} isDot>
                        {row.statusLabel}
                    </Badge>
                    {row.status === "waiting_approval" && row.ownerKind === "agent" ? (
                        <Badge tone="accent">{labels.aiDraft}</Badge>
                    ) : null}
                </>
            }
            actions={
                <div className={ACTIONS_CLASS}>
                    <Button intent="neutral" href={leadHref(row.leadId)}>
                        {labels.open}
                    </Button>
                    <DropdownMenu
                        placement="bottom end"
                        trigger={
                            <Button intent="neutral" size="sm" isPending={props.isDrafting}>
                                {props.isDrafting ? labels.drafting : labels.more}
                            </Button>
                        }
                        entries={entriesOf(props)}
                    />
                </div>
            }
        >
            <div className={META_CLASS}>
                <Text size="xs" tone="muted">
                    {`${labels.owner} ${row.ownerName}`}
                </Text>
                {row.dueLabel === null ? null : (
                    <Text
                        size="xs"
                        tone={row.isOverdue ? "accent" : "muted"}
                        weight={row.isOverdue ? "semibold" : "normal"}
                    >
                        {row.dueLabel}
                    </Text>
                )}
                {props.isCopied ? (
                    <Text size="xs" tone="muted">
                        {labels.linkCopied}
                    </Text>
                ) : null}
            </div>
            {row.status === "done" ? null : (
                <Text size="sm" overflow="clamp-2">
                    {labels.next(row.nextAction)}
                </Text>
            )}
        </ListRow>
    )
}
