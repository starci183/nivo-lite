import { ConnectionDisconnectBand } from "@/components/branches/ConnectionDisconnectBand"
import { ConnectionDisconnectDialog } from "@/components/branches/ConnectionDisconnectDialog"

/** What the disconnect band says and the question it asks first. */
interface ConnectionDisconnectProps {
    readonly props: {
        readonly disconnect?:
            { readonly title: string; readonly description: string; readonly label: string } | undefined
        readonly confirm: Parameters<typeof ConnectionDisconnectDialog>[0]["confirm"]
    }
    readonly on: {
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
    }
}

/** The last band of a provider page's main pane with the question its destructive entry asks first; no band when the page cannot disconnect. */
export const ConnectionDisconnect = (props: ConnectionDisconnectProps) => (
    <>
        {props.props.disconnect === undefined ? null : (
            <ConnectionDisconnectBand {...props.props.disconnect} onPress={props.on.askDisconnect} />
        )}
        <ConnectionDisconnectDialog
            confirm={props.props.confirm}
            onConfirm={props.on.confirmDisconnect}
            onDismiss={props.on.dismiss}
        />
    </>
)
