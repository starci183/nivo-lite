import { ZaloAppStep } from "@/components/blocks/ZaloAppStep"
import { ZaloAuthorizeStep } from "@/components/blocks/ZaloAuthorizeStep"
import { ZaloConnectionAgents } from "@/components/blocks/ZaloConnectionAgents"
import { ZaloConnectionChecks } from "@/components/blocks/ZaloConnectionChecks"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"
import { ZaloConnectionPaste } from "@/components/blocks/ZaloConnectionPaste"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import { ZaloSetupSteps } from "@/components/blocks/ZaloSetupSteps"

/** What the page owner supplies: the connection of the url. */
export interface ZaloConnectionPageBaseProps {
    readonly props: { readonly connectionId: string }
}

/**
 * Draws the page of one Zalo OA connection as one page (no tabs): the frame owns the `Page`; its main pane holds the health tiles, the
 * stepper and the five setup steps in back end order (app keys, the Zalo app, the OA authorized, checks and test send, agents) and the
 * ZNS template; the live Zalo events stand in the rail beside it.
 */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ZaloConnectionHead connectionId={connectionId}>
            <ZaloConnectionFacts connectionId={connectionId} />
            <ZaloSetupSteps connectionId={connectionId} />
            <ZaloAppStep connectionId={connectionId} />
            <ZaloConnectionPaste connectionId={connectionId} />
            <ZaloAuthorizeStep connectionId={connectionId} />
            <ZaloConnectionChecks connectionId={connectionId} />
            <ZaloConnectionAgents connectionId={connectionId} />
            <ZaloConnectionZns connectionId={connectionId} />
        </ZaloConnectionHead>
    )
}
