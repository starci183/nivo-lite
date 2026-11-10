import { Grid, Stack } from "@starci/grammar/common"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { TelegramConnectionEvents } from "@/components/blocks/TelegramConnectionEvents"
import { TelegramConnectionFacts } from "@/components/blocks/TelegramConnectionFacts"
import { TelegramConnectionNotices } from "@/components/blocks/TelegramConnectionNotices"
import { TelegramConnectionSteps } from "@/components/blocks/TelegramConnectionSteps"
import type { ConnectionPageTabId } from "@/modules/types"

/** What the page owner supplies: the connection of the url and the tab the address opens. */
export interface TelegramConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly tab: ConnectionPageTabId
    }
}

/**
 * Draws the open tab of a Telegram bot connection page, under the band its layout draws. Overview: the notices, the setup phases while
 * unfinished, the facts and the agents, with the live rail beside them. Events: the rail alone. Agents: the agents with their levels.
 * Settings: the four setup steps in back end order (the bot and its token, the webhook, the check, the agents).
 */
export const TelegramConnectionPageBase = (props: TelegramConnectionPageBaseProps) => {
    const { connectionId, tab } = props.props
    const notices = <TelegramConnectionNotices connectionId={connectionId} />
    switch (tab) {
        case "overview":
            return (
                <Grid
                    kind="main-rail"
                    railWidth="medium"
                    align="start"
                    primary={
                        <Stack gap="region">
                            {notices}
                            <TelegramConnectionFacts connectionId={connectionId} />
                            <ConnectionAgents connectionId={connectionId} />
                        </Stack>
                    }
                    rail={<TelegramConnectionEvents connectionId={connectionId} />}
                />
            )
        case "events":
            return (
                <Stack gap="region">
                    {notices}
                    <TelegramConnectionEvents connectionId={connectionId} />
                </Stack>
            )
        case "agents":
            return (
                <Stack gap="region">
                    {notices}
                    <ConnectionAgents connectionId={connectionId} />
                </Stack>
            )
        case "settings":
            return (
                <Stack gap="region">
                    {notices}
                    <TelegramConnectionSteps connectionId={connectionId} />
                </Stack>
            )
    }
}
