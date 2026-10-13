import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** One prospect, every word already resolved. */
export interface LeadGenLeadView {
    readonly id: string
    readonly name: string
    readonly href: string
    readonly lastLine: string
    readonly sourceLabel: string
    readonly scoreLabel: string
    readonly scoreTone: BadgeTone
}

/** The words and data of the prospects list. */
export interface LeadGenLeadsBaseProps {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<LeadGenLeadView>
        readonly hiddenText: string | null
    }
}

/** New leads, newest activity first; the name opens the lead and its conversation. */
export const LeadGenLeadsBase = (props: LeadGenLeadsBaseProps) => {
    const { props: p } = props
    return (
        <>
            <SurfaceListCard
                ariaLabel={p.label}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={<TextAction href={row.href}>{row.name}</TextAction>}
                        description={row.lastLine}
                        badges={
                            <>
                                <Badge tone="neutral">{row.sourceLabel}</Badge>
                                <Badge tone={row.scoreTone}>{row.scoreLabel}</Badge>
                            </>
                        }
                    />
                ))}
            </SurfaceListCard>
            {p.hiddenText === null ? null : (
                <Text size="sm" tone="muted">
                    {p.hiddenText}
                </Text>
            )}
        </>
    )
}
