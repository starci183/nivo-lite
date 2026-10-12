import { Badge } from "@starci/grammar/common"

/** What the badge needs: whether the mark is earned, and its words. */
type FoundingBadgeProps = {
    readonly isFoundingMember: boolean
    readonly label: string
}

/** Small top-bar mark, earned by a real module purchase inside the Founding 50 window, drawn as an accent dot badge. */
export const FoundingBadge = (props: FoundingBadgeProps) =>
    props.isFoundingMember ? (
        <Badge tone="accent" isDot>
            {props.label}
        </Badge>
    ) : null
