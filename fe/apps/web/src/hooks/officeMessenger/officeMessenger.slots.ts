import { slotOfReads } from "@/hooks/slot"
import type { useOfficeBoard, useOfficeRooms, useOfficeThread } from "@/hooks/office"
import type { useOfficePanels } from "./useOfficePanels"

type OfficeReadOwners = {
    readonly board: ReturnType<typeof useOfficeBoard>
    readonly hub: ReturnType<typeof useOfficeRooms>
    readonly thread: ReturnType<typeof useOfficeThread>
    readonly list: ReturnType<typeof useOfficePanels>["list"]
}

/** Folds the reads each Office region depends on and retries the same owners. */
export const officeReadSlots = ({ board, hub, thread, list }: OfficeReadOwners) => ({
    slot: thread.slot,
    listSlot: slotOfReads(
        [...hub.listReads, ...board.teamReads, ...board.approvalReads, ...board.workReads],
        () => list,
    ),
    threadSlot: slotOfReads(
        [thread.read, hub.roomRead, hub.markerRead, ...board.teamReads, ...board.approvalReads, ...board.workReads],
        () => true,
    ),
    composerSlot: slotOfReads([...board.composerReads, hub.roomRead], () => true),
    retryList: () => {
        board.reload()
        hub.reload()
    },
    retryThread: () => {
        board.reload()
        hub.refreshRooms()
        hub.reloadMarkers()
        thread.reload()
    },
    retryComposer: () => {
        board.reloadTeam()
        hub.refreshRooms()
    },
})
