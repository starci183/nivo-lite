import { ConnectionProvider } from "@/components/blocks/ConnectionProvider"

/** The provider segment the page draws. */
export interface ConnectionProviderPageBaseProps {
    readonly props: {
        readonly segment: string
    }
}

/** Draws a provider page as its root: the one connected block that draws the Page from client data. */
export const ConnectionProviderPageBase = (props: ConnectionProviderPageBaseProps) => (
    <ConnectionProvider segment={props.props.segment} />
)
