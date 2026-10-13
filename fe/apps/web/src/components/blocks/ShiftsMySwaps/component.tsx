import { Badge, ListItem, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import { ROW_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

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
                    <ListItem key={row.id} className={ROW_CLASS_NAME}>
                        <Text size="sm">{row.text}</Text>
                        <Badge tone={row.tone}>{row.badge}</Badge>
                    </ListItem>
                ))}
            </SurfaceListCard>
        </div>
    )
