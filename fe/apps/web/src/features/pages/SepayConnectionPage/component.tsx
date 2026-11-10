import { Grid, Stack } from "@starci/grammar/common"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { SepayConnectionSteps } from "@/components/blocks/SepayConnectionSteps"
import { SepayHealth } from "@/components/blocks/SepayHealth"
import { SepayNotices } from "@/components/blocks/SepayNotices"
import { SepayRail } from "@/components/blocks/SepayRail"
import type { ConnectionPageTabId } from "@/modules/types"

/** What the page owner supplies: the connection of the url and the tab the address opens. */
export interface SepayConnectionPageBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly tab: ConnectionPageTabId
    }
}

/**
 * Draws the open tab of a SePay connection page, under the band its layout draws. Overview: the notices, the setup phases while
 * unfinished, the connection's details and the agents, with the live webhook events beside them. Events: the events alone. Agents:
 * the agents with their levels. Settings: the five setup steps (environment, bank account, the webhook on SePay with the API key, the
 * test, the accounting agent).
 */
export const SepayConnectionPageBase = (props: SepayConnectionPageBaseProps) => {
    const { connectionId, tab } = props.props
    const notices = <SepayNotices connectionId={connectionId} />
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
                            <SepayHealth connectionId={connectionId} />
                            <ConnectionAgents connectionId={connectionId} />
                        </Stack>
                    }
                    rail={<SepayRail connectionId={connectionId} />}
                />
            )
        case "events":
            return (
                <Stack gap="region">
                    {notices}
                    <SepayRail connectionId={connectionId} />
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
                    <SepayConnectionSteps connectionId={connectionId} />
                </Stack>
            )
    }
}
