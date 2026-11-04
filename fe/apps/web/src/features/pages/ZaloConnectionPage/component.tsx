import { ConnectionGrants } from "@/components/blocks/ConnectionGrants"
import { ConnectionPageRail } from "@/components/blocks/ConnectionPageRail"
import { ZaloAppStep } from "@/components/blocks/ZaloAppStep"
import { ZaloAuthorizeStep } from "@/components/blocks/ZaloAuthorizeStep"
import { ZaloConnectionAgents } from "@/components/blocks/ZaloConnectionAgents"
import { ZaloConnectionChecks } from "@/components/blocks/ZaloConnectionChecks"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"
import { ZaloConnectionNotices } from "@/components/blocks/ZaloConnectionNotices"
import { ZaloConnectionPaste } from "@/components/blocks/ZaloConnectionPaste"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import { ZaloSetupSteps } from "@/components/blocks/ZaloSetupSteps"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** What the page owner supplies: the connection of the url and the words of its panes. */
export interface ZaloConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: { readonly label: string; readonly openLabel: string; readonly closeLabel: string }
    }
}

/**
 * Draws the page of one Zalo OA connection inside the Connections frame: the head band, the health tiles, the stepper and the five
 * setup steps in back end order (app keys, the Zalo app, the OA authorized, checks and test send, agents), the agents with their
 * levels and the ZNS template; the live Zalo events stand in the rail beside it.
 */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ConnectionPaneFrame
            gridLabel={props.props.gridLabel}
            mainLabel={props.props.mainLabel}
            rail={props.props.rail}
            head={<ZaloConnectionHead connectionId={connectionId} />}
            aside={<ConnectionPageRail kind="zalo" connectionId={connectionId} />}
        >
            <ZaloConnectionNotices connectionId={connectionId} />
            <ZaloConnectionFacts connectionId={connectionId} />
            <ZaloSetupSteps connectionId={connectionId} />
            <ZaloAppStep connectionId={connectionId} />
            <ZaloConnectionPaste connectionId={connectionId} />
            <ZaloAuthorizeStep connectionId={connectionId} />
            <ZaloConnectionChecks connectionId={connectionId} />
            <ZaloConnectionAgents connectionId={connectionId} />
            <ConnectionGrants connectionId={connectionId} />
            <ZaloConnectionZns connectionId={connectionId} />
        </ConnectionPaneFrame>
    )
}
