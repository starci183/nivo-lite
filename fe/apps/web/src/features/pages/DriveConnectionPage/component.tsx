import { ConnectionHealthTiles } from "@/components/blocks/ConnectionHealthTiles"
import { ConnectionPageHead } from "@/components/blocks/ConnectionPageHead"
import { ConnectionPageNotices } from "@/components/blocks/ConnectionPageNotices"
import { ConnectionPageRail } from "@/components/blocks/ConnectionPageRail"
import { DriveConnectionSteps } from "@/components/blocks/DriveConnectionSteps"
import { DriveLedger } from "@/components/blocks/DriveLedger"
import { ConnectionPaneFrame } from "@/components/frames/ConnectionPaneFrame"

/** What the page owner supplies: the words of the panes. */
export interface DriveConnectionPageBaseProps {
    readonly props: {
        readonly gridLabel: string
        readonly mainLabel: string
        readonly rail: { readonly label: string; readonly closeLabel: string }
    }
}

/**
 * Draws the page of the Google Drive grant of the workspace (no id: a workspace has one grant) inside the Connections frame: the head
 * band, the health tiles and the three steps (grant the read access, choose documents, find them in Second Brain) and the Google Sheets ledger; the progress of
 * the files being read stands in the rail beside it.
 */
export const DriveConnectionPageBase = (props: DriveConnectionPageBaseProps) => (
    <ConnectionPaneFrame
        gridLabel={props.props.gridLabel}
        mainLabel={props.props.mainLabel}
        rail={props.props.rail}
        head={<ConnectionPageHead kind="drive" />}
        aside={<ConnectionPageRail kind="drive" />}
    >
        <ConnectionPageNotices kind="drive" />
        <ConnectionHealthTiles kind="drive" />
        <DriveConnectionSteps />
        <DriveLedger />
    </ConnectionPaneFrame>
)
