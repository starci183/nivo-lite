/** What the forwarding block says while it forwards. */
export interface ZaloForwardBaseProps {
    readonly props: {
        readonly label: string
    }
}

/** Draws an announced busy region: the page forwards at once and has nothing of its own to show. */
export const ZaloForwardBase = (props: ZaloForwardBaseProps) => (
    <output aria-busy="true" aria-label={props.props.label} />
)
