import { Badge, DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"

/** One term and value pair of the order summary; the applied campaign is drawn as a badge. */
export interface PromoSummaryRow {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly isOffer?: boolean
}

/** Copy and rows of the order summary. */
export interface PromoCheckoutSummaryBaseProps {
    readonly props: { readonly title: string; readonly rows: ReadonlyArray<PromoSummaryRow> }
}

/** Draws the order summary before "Add to workspace": term and value pairs in divided columns, no amount invented. */
export const PromoCheckoutSummaryBase = (props: PromoCheckoutSummaryBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <DescriptionList
            layout="columns"
            isDivided
            items={props.props.rows.map((row) => ({
                id: row.id,
                term: row.label,
                description:
                    row.isOffer === true ? (
                        <Badge tone="accent">{row.value}</Badge>
                    ) : (
                        <Text weight="medium">{row.value}</Text>
                    ),
            }))}
        />
    </SurfaceCard>
)
