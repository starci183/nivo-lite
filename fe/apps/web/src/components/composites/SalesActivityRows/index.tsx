import type { SalesActivityRowsView, ActivityItemView } from "@/modules/types"
import { EmptyNotice, Quote, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
interface SalesActivityRowsProps extends SalesActivityRowsView {
    readonly isLoading: boolean
}
/** Each activity retains its customer destination, action, time and complete evidence. */
const activityItemOf = (row: ActivityItemView, props: SalesActivityRowsProps): ListRowData => ({
    id: row.id,
    title: row.customer === "" ? row.action : row.customer,
    description: row.customer === "" ? row.when : `${row.action} · ${row.when}`,
    badges: [{ label: row.evidenceLabel, tone: row.evidenceTone }],
    ...(row.customer === "" ? {} : { action: { label: row.customer, href: row.href } as const }),
    detail: (
        <Stack gap="row">
            <Text size="sm">{row.summary}</Text>
            {row.evidence === null ? null : <Quote source={props.evidenceTitle} text={row.evidence} />}
            <Text size="xs" tone="muted">
                {props.byPolicy}
            </Text>
        </Stack>
    ),
})
/** Draws the existing native policy-work card from resolved facts. */
export const SalesActivityRows = (props: SalesActivityRowsProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.label}
        isLoading={props.isLoading}
        items={props.rows.map((row) => activityItemOf(row, props))}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
    />
)
