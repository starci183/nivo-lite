import { Grid, Stack } from "@starci/grammar/common"
import type { ReactElement, ReactNode } from "react"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { DriveConnectionEvents } from "@/components/blocks/DriveConnectionEvents"
import { DriveConnectionFacts } from "@/components/blocks/DriveConnectionFacts"
import { DriveConnectionNotices } from "@/components/blocks/DriveConnectionNotices"
import { DriveConnectionSteps } from "@/components/blocks/DriveConnectionSteps"
import { DriveLedger } from "@/components/blocks/DriveLedger"

/** The tab the address opens. */
type DriveTab = "overview" | "events" | "agents" | "settings"

/** What the page owner supplies: the tab the address opens. */
export interface DriveConnectionPageBaseProps {
    readonly props: {
        readonly tab: DriveTab
    }
}

/** The regions of the open tab, top to bottom, under the notices. */
const regionsOf = (tab: DriveTab): ReactNode => {
    switch (tab) {
        case "events":
            return <DriveConnectionEvents />
        case "agents":
            return <ConnectionAgents provider="google_drive" />
        case "settings":
            return (
                <>
                    <DriveConnectionSteps />
                    <DriveLedger />
                </>
            )
        case "overview":
            return (
                <>
                    <DriveConnectionFacts />
                    <ConnectionAgents provider="google_drive" isHiddenWhenEmpty />
                </>
            )
    }
}

/**
 * Draws the body of the Google account page (the layout draws the band and the tabs): the first tab (Services) holds the setup phases
 * while Drive is unfinished, the services list, the facts and the agents (when Drive has grants), with the files being read in the live
 * rail beside them; Events holds
 * the rail alone; Agents the agents; Settings the setup steps (grant the read access, choose folders and first sync, find them in
 * Second Brain) and the Google Sheets ledger.
 */
export const DriveConnectionPageBase = (props: DriveConnectionPageBaseProps): ReactElement => {
    const main = (
        <Stack gap="region">
            <DriveConnectionNotices />
            {regionsOf(props.props.tab)}
        </Stack>
    )
    return props.props.tab === "overview" ? (
        <Grid kind="main-rail" railWidth="medium" align="start" primary={main} rail={<DriveConnectionEvents />} />
    ) : (
        main
    )
}
