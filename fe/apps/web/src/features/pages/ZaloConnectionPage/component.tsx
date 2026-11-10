import { Grid, Stack } from "@starci/grammar/common"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { ZaloConnectionEvents } from "@/components/blocks/ZaloConnectionEvents"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionNotices } from "@/components/blocks/ZaloConnectionNotices"
import { ZaloConnectionSteps } from "@/components/blocks/ZaloConnectionSteps"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import type { ConnectionPageTabId } from "@/modules/types"

/** What the page owner supplies: the connection of the url and the tab the address opens. */
export interface ZaloConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly tab: ConnectionPageTabId
    }
}

/**
 * Draws the open tab of a Zalo OA connection page, under the band its layout draws. Overview: the notices, the setup phases while
 * unfinished, the facts and the agents, with the live rail beside them. Events: the rail alone. Agents: the agents with their levels.
 * Settings: the five setup steps in back end order (app keys, the Zalo app, the OA authorized, checks and test send, agents) and the
 * ZNS template.
 */
export const ZaloConnectionPageBase = (props: ZaloConnectionPageBaseProps) => {
    const { connectionId, tab } = props.props
    const notices = <ZaloConnectionNotices connectionId={connectionId} />
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
                            <ZaloConnectionFacts connectionId={connectionId} />
                            <ConnectionAgents connectionId={connectionId} />
                        </Stack>
                    }
                    rail={<ZaloConnectionEvents connectionId={connectionId} />}
                />
            )
        case "events":
            return (
                <Stack gap="region">
                    {notices}
                    <ZaloConnectionEvents connectionId={connectionId} />
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
                    <ZaloConnectionSteps connectionId={connectionId} />
                    <ZaloConnectionZns connectionId={connectionId} />
                </Stack>
            )
    }
}
