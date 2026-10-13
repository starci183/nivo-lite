import { Tabs } from "@starci/grammar/common"

/** The two views of the Connections page: what is connected, and the connector library. */
export interface ConnectionViewTabsBaseProps {
    readonly props: {
        readonly label: string
        readonly selected: string
        readonly connectedLabel: string
        readonly libraryLabel: string
    }
    readonly on: {
        readonly select: (id: string) => void
    }
}

/** The page's primary tabs. */
export const ConnectionViewTabsBase = (props: ConnectionViewTabsBaseProps) => (
    <Tabs
        variant="primary"
        label={props.props.label}
        selectedKey={props.props.selected}
        onSelect={(key) => props.on.select(String(key))}
        items={[
            { id: "connected", label: props.props.connectedLabel },
            { id: "library", label: props.props.libraryLabel },
        ]}
    />
)
