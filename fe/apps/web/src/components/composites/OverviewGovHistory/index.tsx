import { EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
import type { GovHistoryRow } from "@/hooks/overviewGov"

/** The figures of the history block. */
export interface OverviewGovHistoryProps {
    /** The first history read has not settled; the Grammar keeps the collection geometry. */
    readonly isLoading?: boolean
    readonly figures: {
        readonly title: string
        readonly allLabel: string
        readonly allHref: string
        readonly empty: string
        readonly rows: ReadonlyArray<GovHistoryRow>
        readonly source: string
    }
}

/** The latest decisions of the log: one row each in one list, the source under it. */
export const OverviewGovHistory = (props: OverviewGovHistoryProps) => (
    <SurfaceCard
        kind="list"
        label={props.figures.title}
        isLoading={props.isLoading === true}
        labelEnd={<Link href={props.figures.allHref}>{props.figures.allLabel}</Link>}
        empty={<EmptyNotice message={props.figures.empty} />}
        footer={props.figures.source}
        items={props.figures.rows.map((row) => ({
            id: row.id,
            title: row.action,
            description: `${row.when} · ${row.detail}`,
            badges: [{ label: row.outcome, tone: row.outcomeTone }],
        }))}
    />
)
