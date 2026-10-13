import { Badge, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"

/** One source, every word already resolved. */
export interface LeadGenSourceView {
    readonly key: string
    readonly name: string
    readonly counts: string
    readonly sourceLabel: string
}

/** The words and data of the sources tab. */
export interface LeadGenSourcesBaseProps {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<LeadGenSourceView>
    }
}

/** Per post, ad or form, how many leads it brought, how many are hot and how many were won. */
export const LeadGenSourcesBase = (props: LeadGenSourcesBaseProps) => {
    const { props: p } = props
    return (
        <SurfaceListCard ariaLabel={p.label} empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}>
            {p.rows.map((row) => (
                <ListRow
                    key={row.key}
                    title={row.name}
                    description={row.counts}
                    badges={<Badge tone="neutral">{row.sourceLabel}</Badge>}
                />
            ))}
        </SurfaceListCard>
    )
}
