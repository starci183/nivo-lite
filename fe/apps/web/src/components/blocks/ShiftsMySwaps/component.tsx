import { Badge, ListRow, SurfaceListCard } from "@starci/grammar/common"

/** Copy and requests the connected swap list supplies. */
export interface ShiftsMySwapsBaseProps {
    readonly props: {
        readonly title: string
        readonly rows: ReadonlyArray<{
            readonly id: string
            readonly text: string
            readonly tone: "success" | "neutral" | "warning"
            readonly badge: string
        }>
    }
}

/** Draws my swap and open-shift requests with their state; nothing when there are none. */
export const ShiftsMySwapsBase = (props: ShiftsMySwapsBaseProps) =>
    props.props.rows.length === 0 ? null : (
        <SurfaceListCard label={props.props.title} headingLevel={2}>
            {props.props.rows.map((row) => (
                <ListRow key={row.id} title={row.text} badges={<Badge tone={row.tone}>{row.badge}</Badge>} />
            ))}
        </SurfaceListCard>
    )
