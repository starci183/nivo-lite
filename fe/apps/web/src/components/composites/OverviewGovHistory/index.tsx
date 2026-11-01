import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovHistoryRow } from "@/hooks/overviewGov"

/** The figures of the history block. */
export interface OverviewGovHistoryProps {
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
    <AccountingBlock label={props.figures.title}>
        <SurfaceListCard
            label={props.figures.title}
            labelEnd={
                <TextAction href={props.figures.allHref} appearance="section">
                    {props.figures.allLabel}
                </TextAction>
            }
            empty={<EmptyNotice message={props.figures.empty} />}
            footer={props.figures.source}
        >
            {props.figures.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.action}
                    description={`${row.when} · ${row.detail}`}
                    badges={<Badge tone={row.outcomeTone}>{row.outcome}</Badge>}
                />
            ))}
        </SurfaceListCard>
    </AccountingBlock>
)
