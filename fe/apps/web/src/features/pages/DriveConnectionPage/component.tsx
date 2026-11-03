import { ConnectionHealthTiles } from "@/components/blocks/ConnectionHealthTiles"
import { ConnectionPageHead } from "@/components/blocks/ConnectionPageHead"
import { DriveConnectionSteps } from "@/components/blocks/DriveConnectionSteps"

/**
 * Draws the page of the workspace's Google Drive grant as one page (no tabs, no id: a workspace has one grant): the frame owns the
 * `Page`; its main pane holds the health tiles and the three steps (grant the read access, choose documents, find them in Second
 * Brain); the progress of the files being read stands in the rail beside it.
 */
export const DriveConnectionPageBase = () => (
    <ConnectionPageHead kind="drive">
        <ConnectionHealthTiles kind="drive" />
        <DriveConnectionSteps />
    </ConnectionPageHead>
)
