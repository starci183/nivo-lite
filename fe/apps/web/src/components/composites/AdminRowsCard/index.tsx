import { Cluster, Code, EmptyNotice, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { AdminBadges } from "@/components/leaves/AdminBadges"
import type { AdminCardView, AdminRowView } from "@/modules/types"

/** What one bounded console collection draws before and after its first read. */
type AdminRowsCardProps = { readonly card: AdminCardView; readonly isLoading?: boolean }

/** Preserves the row's note, command and diagnostic text while the collection owns its anatomy. */
const itemOf = (row: AdminRowView, isLoading: boolean): ListRowData => {
    const [status, exception, ...facts] = row.badges
    let badges: ListRowData["badges"]
    if (status !== undefined) badges = exception === undefined ? [status] : [status, exception]
    return {
        id: row.id,
        title: row.title,
        ...(row.lines.length === 0 ? {} : { description: row.lines.join(" · ") }),
        ...(badges === undefined ? {} : { badges }),
        ...(row.link === undefined ? {} : { action: { label: row.link.label, href: row.link.href } }),
        detail:
            facts.length === 0 && row.note === undefined && row.mono === undefined ? undefined : (
                <Stack gap="inline">
                    {facts.map((fact) => (
                        <Text key={fact.id} size="xs" tone="muted" isLoading={isLoading}>
                            {fact.label}
                        </Text>
                    ))}
                    {row.note === undefined ? null : (
                        <Text size="xs" tone="muted" isLoading={isLoading}>
                            {row.note}
                        </Text>
                    )}
                    {row.mono === undefined ? null : <Code isLoading={isLoading}>{row.mono}</Code>}
                </Stack>
            ),
    }
}

/** One list card of the console, with the label, badges and empty state in their native slots. */
export const AdminRowsCard = (props: AdminRowsCardProps) => (
    <SurfaceCard
        kind="list"
        label={props.card.label}
        {...(props.card.ariaLabel === undefined ? {} : { ariaLabel: props.card.ariaLabel })}
        headingLevel={2}
        isLoading={props.isLoading === true}
        labelEnd={
            props.card.labelBadges.length === 0 ? undefined : (
                <Cluster gap="inline">
                    <AdminBadges badges={props.card.labelBadges} isLoading={props.isLoading === true} />
                </Cluster>
            )
        }
        empty={<EmptyNotice message={props.card.emptyMessage} />}
        items={props.card.rows.map((row) => itemOf(row, props.isLoading === true))}
    />
)
