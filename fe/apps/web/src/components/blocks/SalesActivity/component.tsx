import { Badge, EmptyNotice, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesRow } from "@/components/branches/SalesRow"

/** One thing NIVO did by policy, every word already resolved. */
export interface ActivityItemView {
    readonly id: string
    readonly action: string
    readonly evidenceLabel: string
    readonly evidenceTone: BadgeTone
    readonly when: string
    readonly customer: string
    readonly href: string
    readonly summary: string
    readonly evidence: string | null
}

/** The words and data of the activity surface. */
export interface SalesActivityBaseProps {
    readonly props: {
        readonly label: string
        readonly intro: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<ActivityItemView>
        readonly evidenceTitle: string
        readonly byPolicy: string
    }
}

/** Surface 6: routine work NIVO did by policy, inside the authority the owner gave, with its evidence. */
export const SalesActivityBase = (props: SalesActivityBaseProps) => {
    const { props: p } = props
    return (
        <>
            <Text size="sm" tone="muted">
                {p.intro}
            </Text>
            <SurfaceListCard
                ariaLabel={p.label}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <SalesRow
                        key={row.id}
                        chips={
                            <>
                                <Text as="span" weight="semibold">
                                    {row.action}
                                </Text>
                                <Badge tone={row.evidenceTone}>{row.evidenceLabel}</Badge>
                                <Text as="span" size="xs" tone="muted">
                                    {row.when}
                                </Text>
                            </>
                        }
                        customer={row.customer}
                        customerHref={row.href}
                    >
                        <Text size="sm">{row.summary}</Text>
                        {row.evidence === null ? null : (
                            <SurfaceCard ariaLabel={p.evidenceTitle}>
                                <Text size="xs" tone="muted" weight="medium">
                                    {p.evidenceTitle}
                                </Text>
                                <Text as="p" size="sm" overflow="clamp-2">
                                    {row.evidence}
                                </Text>
                            </SurfaceCard>
                        )}
                        <Text size="xs" tone="muted">
                            {p.byPolicy}
                        </Text>
                    </SalesRow>
                ))}
            </SurfaceListCard>
        </>
    )
}
