import { PageContainer } from "@starci/grammar/common"
import { ZaloConnectionAgents } from "@/components/blocks/ZaloConnectionAgents"
import { ZaloConnectionChecks } from "@/components/blocks/ZaloConnectionChecks"
import { ZaloConnectionEvents } from "@/components/blocks/ZaloConnectionEvents"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"
import { ZaloConnectionPaste } from "@/components/blocks/ZaloConnectionPaste"
import { ZaloConnectionTestSend } from "@/components/blocks/ZaloConnectionTestSend"
import type { ZaloTab } from "@/modules/types"
import { ASIDE, BODY, FRAME, MAIN } from "./classNames"

/** The arrangements of the page: one per tab. */
export const ZALO_CONNECTION_SHAPES = ["overview", "setup", "check", "agents"] as const satisfies ReadonlyArray<ZaloTab>

/** One drawing per tab the owner approved. */
export type ZaloConnectionShape = (typeof ZALO_CONNECTION_SHAPES)[number]

/** What the page owner supplies: the connection of the url and the tab it asked for. */
export interface ZaloConnectionPageBaseProps {
    readonly shape: ZaloConnectionShape
    readonly props: { readonly connectionId: string }
}

const Body = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId } = props.props
    switch (props.shape) {
        case "overview":
            return <ZaloConnectionFacts connectionId={connectionId} kind="overview" />
        case "setup":
            return (
                <>
                    <ZaloConnectionFacts connectionId={connectionId} kind="setup" />
                    <ZaloConnectionPaste connectionId={connectionId} />
                </>
            )
        case "check":
            return (
                <>
                    <ZaloConnectionChecks connectionId={connectionId} />
                    <ZaloConnectionTestSend connectionId={connectionId} />
                    <ZaloConnectionPaste connectionId={connectionId} />
                </>
            )
        case "agents":
            return <ZaloConnectionAgents connectionId={connectionId} />
    }
}

/** Draws the page of one Zalo OA connection: the header and the tab body on the left, the live Zalo events docked on the right. */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => (
    <PageContainer measure="product">
        <div className={FRAME}>
            <div className={MAIN}>
                <ZaloConnectionHead connectionId={props.props.connectionId} tab={props.shape} />
                <div className={BODY}>
                    <Body {...props} />
                </div>
            </div>
            <aside className={ASIDE}>
                <ZaloConnectionEvents connectionId={props.props.connectionId} />
            </aside>
        </div>
    </PageContainer>
)
