import { Badge } from "@starci/grammar/common"
import type { AdminBadgeView } from "@/hooks/admin"

/** The badges a row, a cell or a card label carries. */
type AdminBadgesProps = {
    readonly badges: ReadonlyArray<AdminBadgeView>
}

/** Draws a run of badges, each in the tone of its status. */
export const AdminBadges = (props: AdminBadgesProps) => (
    <>
        {props.badges.map((entry) => (
            <Badge key={entry.id} tone={entry.tone} isDot={entry.isDot}>
                {entry.label}
            </Badge>
        ))}
    </>
)
