import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"
import { ZaloConnectionNotices } from "@/components/blocks/ZaloConnectionNotices"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import { ZaloConnectionSteps } from "@/components/blocks/ZaloConnectionSteps"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** What the page owner supplies: the connection of the url and the words of its panes. */
export interface ZaloConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly gridLabel: string
        readonly mainLabel: string
    }
}

/**
 * Draws the page of one Zalo OA connection inside the Connections frame: the head band, the health tiles, the stepper and the five
 * setup steps in back end order (app keys, the Zalo app, the OA authorized, checks and test send, agents), the agents with their
 * levels and the ZNS template.
 */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ConnectionPaneFrame
            gridLabel={props.props.gridLabel}
            mainLabel={props.props.mainLabel}
            head={<ZaloConnectionHead connectionId={connectionId} />}
        >
            <ZaloConnectionNotices connectionId={connectionId} />
            <ZaloConnectionFacts connectionId={connectionId} />
            <ZaloConnectionSteps connectionId={connectionId} />
            <ZaloConnectionZns connectionId={connectionId} />
        </ConnectionPaneFrame>
    )
}
