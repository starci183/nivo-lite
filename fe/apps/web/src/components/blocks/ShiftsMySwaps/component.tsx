import { Badge, ListRow, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import { SECTION_CLASS_NAME } from "./classNames"

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
        <div className={SECTION_CLASS_NAME}>
            <SectionHeader level={2} title={props.props.title} />
            <SurfaceListCard ariaLabel={props.props.title}>
                {props.props.rows.map((row) => (
                    <ListRow key={row.id} title={row.text} badges={<Badge tone={row.tone}>{row.badge}</Badge>} />
                ))}
            </SurfaceListCard>
        </div>
    )
