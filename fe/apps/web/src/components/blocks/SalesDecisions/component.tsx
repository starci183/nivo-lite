import { Badge, EmptyNotice, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesDecisionRow } from "@/components/composites/SalesDecisionRow"
import type { DecisionRowActions, DecisionRowLabels, DecisionRowView } from "@/components/composites/SalesDecisionRow"
import { SalesRow } from "@/components/branches/SalesRow"

/** One decision already made, every word already resolved. */
export interface DecidedView {
    readonly id: string
    readonly action: string
    readonly outcomeLabel: string
    readonly outcomeTone: BadgeTone
    readonly customer: string
    readonly href: string | null
    readonly byline: string
    readonly basis: string | null
    readonly rest: string | null
}

/** The words and data of the decisions surface. */
export interface SalesDecisionsBaseProps {
    readonly props: {
        readonly pendingLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly decidedTitle: string
        readonly decidedBody: string
        readonly decidedEmptyTitle: string
        readonly decidedEmptyBody: string
        readonly pending: ReadonlyArray<DecisionRowView>
        readonly rowLabels: DecisionRowLabels
        readonly decided: ReadonlyArray<DecidedView>
    }
    readonly on: DecisionRowActions
}

/** Surface 3: sales decisions waiting for a person, then the ones already made. */
export const SalesDecisionsBase = (props: SalesDecisionsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <SurfaceListCard
                ariaLabel={p.pendingLabel}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.pending.map((row) => (
                    <SalesDecisionRow key={row.id} row={row} labels={p.rowLabels} on={on} />
                ))}
            </SurfaceListCard>
            <SectionHeader level={2} title={p.decidedTitle} description={p.decidedBody} />
            <SurfaceListCard
                ariaLabel={p.decidedTitle}
                empty={<EmptyNotice message={p.decidedEmptyTitle} description={p.decidedEmptyBody} />}
            >
                {p.decided.map((row) => (
                    <SalesRow
                        key={row.id}
                        chips={
                            <>
                                <Text as="span" weight="semibold">
                                    {row.action}
                                </Text>
                                <Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>
                            </>
                        }
                        customer={row.customer}
                        customerHref={row.href}
                    >
                        <Text size="xs" tone="muted">
                            {row.byline}
                        </Text>
                        {row.basis === null ? null : (
                            <Text size="sm" weight="medium">
                                {row.basis}
                            </Text>
                        )}
                        {row.rest === null ? null : (
                            <Text size="sm" tone="muted" overflow="clamp-2">
                                {row.rest}
                            </Text>
                        )}
                    </SalesRow>
                ))}
            </SurfaceListCard>
        </>
    )
}
