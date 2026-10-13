import { Badge } from "@starci/grammar/common"

/** One status chip of a connection. */
export interface ConnectionStatusBadgeBaseProps {
    readonly props: {
        readonly label: string
        readonly tone: "success" | "danger" | "warning" | "neutral"
    }
}

/** A dotted badge in the tone of the status. */
export const ConnectionStatusBadgeBase = (props: ConnectionStatusBadgeBaseProps) => (
    <Badge isDot tone={props.props.tone}>
        {props.props.label}
    </Badge>
)
