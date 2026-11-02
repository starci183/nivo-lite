import type { ShiftsPersonalViews } from "@/modules/types"
type ShiftsMySwapsProps = ShiftsPersonalViews["mySwaps"] & {
    readonly isLoading?: boolean
}
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** Draws my swap and open-shift requests with their state; nothing when there are none. */
export const ShiftsMySwaps = (props: ShiftsMySwapsProps) =>
    props.rows.length === 0 ? null : (
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            kind="list"
            label={props.title}
            headingLevel={2}
            empty={<EmptyNotice message={props.emptyLabel} />}
            items={props.rows.map((row) => ({
                id: row.id,
                title: row.text,
                badges: [{ label: row.badge, tone: row.tone }],
            }))}
        />
    )
