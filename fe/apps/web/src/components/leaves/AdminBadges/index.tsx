import { Badge } from "@starci/grammar/common"
import type { AdminBadgeView } from "@/hooks/admin"

/** The badges a row, a cell or a card label carries. */
type AdminBadgesProps = {
    readonly badges: ReadonlyArray<AdminBadgeView>
    /** Draws the badges as skeletons while the read is on its way. */
    readonly isSkeleton?: boolean | undefined
}

/** Draws a run of badges, each in the tone of its status. */
export const AdminBadges = (props: AdminBadgesProps) => (
    <>
        {props.badges.map((entry) => (
            <Badge
                key={entry.id}
                tone={entry.tone}
                isSkeleton={props.isSkeleton === true}
                {...(entry.isDot === undefined ? {} : { isDot: entry.isDot })}
            >
                {entry.label}
            </Badge>
        ))}
    </>
)
