import { Alert } from "@starci/grammar/common"

/** The first connection that needs attention: what is wrong and, for the owner, the way back into its wizard. */
export interface ConnectionAttentionBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        /** Absent when the viewer cannot manage connections or the wizard cannot be reopened. */
        readonly actionLabel?: string
    }
    readonly on: {
        readonly action: () => void
    }
}

/** One cautionary alert above the tabs; the page's only filled action lives in it. */
export const ConnectionAttentionBase = (props: ConnectionAttentionBaseProps) => (
    <Alert
        tone="cautionary"
        title={props.props.title}
        description={props.props.description}
        {...(props.props.actionLabel === undefined
            ? {}
            : { action: { label: props.props.actionLabel, onAction: props.on.action } })}
    />
)
