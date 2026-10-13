import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** One lead handed to Sales, every word already resolved. */
export interface LeadGenHandoffView {
    readonly key: string
    readonly name: string
    readonly href: string
    readonly line: string
    readonly scoreLabel: string
    readonly scoreTone: BadgeTone
    readonly classifyLabel: string
    readonly classifyTone: BadgeTone
}

/** The words and data of the hand-offs tab. */
export interface LeadGenHandoffsBaseProps {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<LeadGenHandoffView>
    }
}

/** The leads handed over and where the Sales classify step stands. */
export const LeadGenHandoffsBase = (props: LeadGenHandoffsBaseProps) => {
    const { props: p } = props
    return (
        <SurfaceListCard ariaLabel={p.label} empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}>
            {p.rows.map((row) => (
                <ListRow
                    key={row.key}
                    title={<TextAction href={row.href}>{row.name}</TextAction>}
                    description={row.line}
                    badges={
                        <>
                            <Badge tone={row.scoreTone}>{row.scoreLabel}</Badge>
                            <Badge tone={row.classifyTone} isDot>
                                {row.classifyLabel}
                            </Badge>
                        </>
                    }
                />
            ))}
        </SurfaceListCard>
    )
}
