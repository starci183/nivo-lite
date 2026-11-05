import { Badge, Button, Cluster, Heading, ListBox, PaneSection, Stack, Text } from "@starci/grammar/common"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { PaneHead } from "@/components/composites/PaneHead"
import type { MapDetailView } from "@/hooks/brain"

/** What the side pane of the map draws. */
interface DossierMapDetailProps {
    readonly detail: MapDetailView
    readonly isWaiting: boolean
    /** Opens the address a row leads to. */
    readonly onOpen: (href: string) => void
}

/** The rows of the selected node: the dossiers of a category, or the dossiers at each status with their count. */
const Rows = (props: DossierMapDetailProps) => {
    const { detail } = props
    if (detail.rows.length === 0) return null
    return (
        <Stack gap="row">
            <Heading level={3} isLoading={props.isWaiting}>
                {detail.rowsLabel}
            </Heading>
            <ListBox
                label={detail.rowsLabel}
                isLoading={props.isWaiting}
                onAction={(id) => {
                    const href = detail.rows.find((row) => row.id === id)?.href
                    if (href !== undefined && href !== null) props.onOpen(href)
                }}
                items={detail.rows.map((row) => ({
                    id: row.id,
                    label: row.label,
                    ...(row.description === null ? {} : { description: row.description, descriptionLines: 1 as const }),
                    trailing: <RowTrailing badge={row.badge} />,
                }))}
            />
        </Stack>
    )
}

/**
 * The side pane of the map: the whole set by default (a hint and the dossiers at each status), or the category or dossier the
 * map selects, with its rows and the way to open the dossier.
 */
export const DossierMapDetail = (props: DossierMapDetailProps) => {
    const { detail } = props
    return (
        <>
            <PaneHead title={detail.title} headingLevel={2} isLoading={props.isWaiting} />
            <PaneSection gap="section">
                {detail.badges.length === 0 ? null : (
                    <Cluster gap="inline">
                        {detail.badges.map((badge) => (
                            <Badge key={badge.id} tone={badge.tone}>
                                {badge.label}
                            </Badge>
                        ))}
                    </Cluster>
                )}
                {detail.lines.map((line) => (
                    <Text key={line} size="sm" tone="muted" isLoading={props.isWaiting}>
                        {line}
                    </Text>
                ))}
                {detail.action === null ? null : (
                    <Button intent="commit" width="fill" href={detail.action.href}>
                        {detail.action.label}
                    </Button>
                )}
                <Rows {...props} />
            </PaneSection>
        </>
    )
}
