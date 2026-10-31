import { ZaloConnectionAgents } from "@/components/blocks/ZaloConnectionAgents"
import { ZaloConnectionChecks } from "@/components/blocks/ZaloConnectionChecks"
import { ZaloConnectionEvents } from "@/components/blocks/ZaloConnectionEvents"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"
import { ZaloConnectionPaste } from "@/components/blocks/ZaloConnectionPaste"
import { ZaloConnectionTestSend } from "@/components/blocks/ZaloConnectionTestSend"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import { ZaloSetupSteps } from "@/components/blocks/ZaloSetupSteps"

/** What the page owner supplies: the connection of the url. */
export interface ZaloConnectionPageBaseProps {
    readonly props: { readonly connectionId: string }
}

/**
 * Draws the page of one Zalo OA connection as one page (no tabs): the frame owns the `Page`; its main pane holds the health tiles, the
 * five setup steps in back end order (app keys, the Zalo app, the OA authorized, checks and test send, agents) and the ZNS template;
 * the live Zalo events stand in the rail beside it.
 */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ZaloConnectionHead
            connectionId={connectionId}
            shape={{
                main: (
                    <>
                        <ZaloConnectionFacts connectionId={connectionId} kind="tiles" />
                        <ZaloSetupSteps
                            connectionId={connectionId}
                            shape={{
                                app: <ZaloConnectionFacts connectionId={connectionId} kind="saved" />,
                                paste: <ZaloConnectionPaste connectionId={connectionId} />,
                                check: (
                                    <>
                                        <ZaloConnectionChecks connectionId={connectionId} />
                                        <ZaloConnectionTestSend connectionId={connectionId} />
                                    </>
                                ),
                                agents: <ZaloConnectionAgents connectionId={connectionId} />,
                            }}
                        />
                        <ZaloConnectionZns connectionId={connectionId} />
                    </>
                ),
                rail: <ZaloConnectionEvents connectionId={connectionId} />,
            }}
        />
    )
}
