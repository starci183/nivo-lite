import { Button, Cluster, DropdownMenu, Stack, Text, type DropdownMenuEntry } from "@starci/grammar/common"

import { nivoIconSource } from "@/components/leaves/Icon"
import type { ResponsibilityRowView } from "@/modules/types"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"

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
    readonly isLoading?: boolean
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

/** One responsibility as data for its owner's collection, with pending commands and settled feedback in its detail. */
export const ResponsibilityLine = (props: ResponsibilityLineProps) => {
    const { row, labels } = props

    return (
        <Stack gap="inline">
            <Cluster gap="inline">
                <Button intent="neutral" href={leadHref(row.leadId)} isLoading={props.isLoading === true}>
                    {labels.open}
                </Button>
                <DropdownMenu
                    placement="bottom end"
                    trigger={
                        <Button
                            intent="neutral"
                            size="sm"
                            isPending={props.isDrafting}
                            isLoading={props.isLoading === true}
                        >
                            {props.isDrafting ? labels.drafting : labels.more}
                        </Button>
                    }
                    entries={entriesOf(props)}
                />
            </Cluster>
            <Cluster gap="inline">
                <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                    {`${labels.owner} ${row.ownerName}`}
                </Text>
                {row.dueLabel === null ? null : (
                    <Text
                        size="xs"
                        tone={row.isOverdue ? "default" : "muted"}
                        isStrong={row.isOverdue}
                        isLoading={props.isLoading === true}
                    >
                        {row.dueLabel}
                    </Text>
                )}
                {props.isCopied ? (
                    <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                        {labels.linkCopied}
                    </Text>
                ) : null}
            </Cluster>
            {row.status === "done" ? null : (
                <Text size="sm" overflow="clamp-2" isLoading={props.isLoading === true}>
                    {labels.next(row.nextAction)}
                </Text>
            )}
        </Stack>
    )
}
