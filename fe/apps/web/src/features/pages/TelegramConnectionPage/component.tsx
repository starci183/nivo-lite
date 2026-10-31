import { ConnectionEventsRail } from "@/components/blocks/ConnectionEventsRail"
import { ConnectionHealthTiles } from "@/components/blocks/ConnectionHealthTiles"
import { ConnectionPageHead } from "@/components/blocks/ConnectionPageHead"
import { TelegramConnectionAgents } from "@/components/blocks/TelegramConnectionAgents"
import { TelegramConnectionChecks } from "@/components/blocks/TelegramConnectionChecks"
import { TelegramConnectionSteps } from "@/components/blocks/TelegramConnectionSteps"
import { TelegramConnectionWebhook } from "@/components/blocks/TelegramConnectionWebhook"

/** What the page owner supplies: the connection of the url. */
export interface TelegramConnectionPageBaseProps {
    readonly props: { readonly connectionId: string }
}

/**
 * Draws the page of one Telegram bot connection as one page (no tabs): the frame owns the `Page`; its main pane holds the health
 * tiles and the four steps in back end order (the bot and its token, the webhook, the check, the agents); the live Telegram events
 * stand in the rail beside it.
 */
export const TelegramConnectionPageBase = (props: TelegramConnectionPageBaseProps) => {
    const { connectionId } = props.props
    return (
        <ConnectionPageHead
            kind="telegram"
            connectionId={connectionId}
            shape={{
                main: (
                    <>
                        <ConnectionHealthTiles kind="telegram" connectionId={connectionId} />
                        <TelegramConnectionSteps
                            connectionId={connectionId}
                            shape={{
                                webhook: <TelegramConnectionWebhook connectionId={connectionId} />,
                                check: <TelegramConnectionChecks connectionId={connectionId} />,
                                agents: <TelegramConnectionAgents connectionId={connectionId} />,
                            }}
                        />
                    </>
                ),
                rail: <ConnectionEventsRail kind="telegram" connectionId={connectionId} />,
            }}
        />
    )
}
