import type { ReactElement } from "react"
import { Badge } from "@starci/grammar/common"
import type { AdminBadgeView } from "@/hooks/admin"

/** The badges a row, a cell or a card label carries. */
type AdminBadgesProps = {
    readonly badges: ReadonlyArray<AdminBadgeView>
    /** Draws the badges as skeletons while the read is on its way. */
    readonly isLoading?: boolean | undefined
}

/** Draws a run of badges, each in the tone of its status. */
export const AdminBadges = (props: AdminBadgesProps): Array<ReactElement> =>
    props.badges.map((entry) => (
        <Badge
            key={entry.id}
            tone={entry.tone}
            isLoading={props.isLoading === true}
            {...(entry.isDot === undefined ? {} : { isDot: entry.isDot })}
        >
            {entry.label}
        </Badge>
    ))
