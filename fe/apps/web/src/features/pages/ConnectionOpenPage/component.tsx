import { Grid, Stack } from "@starci/grammar/common"
import type { ReactElement, ReactNode } from "react"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { ConnectionOpenContent } from "@/components/blocks/ConnectionOpenContent"
import { ConnectionOpenEvents } from "@/components/blocks/ConnectionOpenEvents"
import { ConnectionOpenFacts } from "@/components/blocks/ConnectionOpenFacts"

/** The tab the address opens. */
type OpenTab = "overview" | "events" | "agents" | "settings"

/** What the page owner supplies: the tab the address opens. */
export interface ConnectionOpenPageBaseProps {
    readonly props: { readonly tab: OpenTab; readonly connectionId: string }
}

/** The regions of the open tab, top to bottom. */
const regionsOf = (props: ConnectionOpenPageBaseProps["props"]): ReactNode => {
    switch (props.tab) {
        case "events":
            return <ConnectionOpenEvents />
        case "agents":
            return <ConnectionAgents connectionId={props.connectionId} />
        case "settings":
            return <ConnectionOpenContent />
        case "overview":
            return (
                <>
                    <ConnectionOpenContent />
                    <ConnectionOpenFacts />
                    <ConnectionAgents connectionId={props.connectionId} isHiddenWhenEmpty />
                </>
            )
    }
}

/**
 * Draws the body of a connection that has no page of its own (the layout draws the band and the tabs): the overview holds the row's
 * alerts, notes, SMTP panel and keys, the details and the agents, with the latest event in the rail beside them; Events the rail alone;
 * Agents the agents; Settings the row's commands again (the panel and the keys).
 */
export const ConnectionOpenPageBase = (props: ConnectionOpenPageBaseProps): ReactElement => {
    const main = <Stack gap="region">{regionsOf(props.props)}</Stack>
    return props.props.tab === "overview" ? (
        <Grid kind="main-rail" railWidth="medium" align="start" primary={main} rail={<ConnectionOpenEvents />} />
    ) : (
        main
    )
}
