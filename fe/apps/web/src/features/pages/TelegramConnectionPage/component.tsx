import { ConnectionHealthTiles } from "@/components/blocks/ConnectionHealthTiles"
import { ConnectionPageHead } from "@/components/blocks/ConnectionPageHead"
import { ConnectionPageNotices } from "@/components/blocks/ConnectionPageNotices"
import { TelegramConnectionSteps } from "@/components/blocks/TelegramConnectionSteps"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** What the page owner supplies: the connection of the url and the words of its panes. */
export interface TelegramConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly gridLabel: string
        readonly mainLabel: string
    }
}

/**
 * Draws the page of one Telegram bot connection inside the Connections frame: the head band, the health tiles, the four steps in back
 * end order (the bot and its token, the webhook, the check, the agents).
 */
export const TelegramConnectionPageBase = (props: TelegramConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ConnectionPaneFrame
            gridLabel={props.props.gridLabel}
            mainLabel={props.props.mainLabel}
            head={<ConnectionPageHead kind="telegram" connectionId={connectionId} />}
        >
            <ConnectionPageNotices kind="telegram" connectionId={connectionId} />
            <ConnectionHealthTiles kind="telegram" connectionId={connectionId} />
            <TelegramConnectionSteps connectionId={connectionId} />
        </ConnectionPaneFrame>
    )
}
