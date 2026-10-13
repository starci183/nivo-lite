import { Badge, type BadgeTone } from "@starci/grammar/common"

/** Props of {@link ContentStatusBadge}. */
interface ContentStatusBadgeProps {
    /** The tone of the status. */
    readonly tone: BadgeTone
    /** The status name, already translated. */
    readonly label: string
}

/** The status of a post as a dot badge. */
export const ContentStatusBadge = (props: ContentStatusBadgeProps) => (
    <Badge tone={props.tone} isDot>
        {props.label}
    </Badge>
)
