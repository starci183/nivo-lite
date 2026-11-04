import { useMemo } from "react"
import type { OfficeBoard, useOfficeRooms, useOfficeWords } from "@/hooks/office"
import { waitingOf } from "@/modules/office"
import type { OfficeRoom, OfficeWaiting, withReceipt } from "@/modules/office"
import { useOfficePanels } from "./useOfficePanels"

/** The panels of a room and the things that wait for a person's decision. */
interface OfficePanelBundle {
    readonly waiting: ReadonlyArray<OfficeWaiting>
    readonly panels: ReturnType<typeof useOfficePanels>
}

/** Resolves the room-scoped panel read and the waiting targets from the same board. */
export const useOfficePanelBundle = (
    messages: ReturnType<typeof withReceipt> | undefined,
    board: OfficeBoard,
    words: ReturnType<typeof useOfficeWords>,
    current: OfficeRoom | null,
    roomKey: string | null,
    hub: ReturnType<typeof useOfficeRooms>,
    roomAgents: OfficeBoard["agents"],
): OfficePanelBundle => {
    const waiting = useMemo(() => waitingOf(board.pending, board.exceptions), [board.pending, board.exceptions])
    const panelRoom = useMemo(
        () => ({
            current,
            key: roomKey,
            rooms: hub.rooms,
            channels: hub.channels,
            agents: roomAgents,
            unread: hub.unread,
        }),
        [current, roomKey, hub.rooms, hub.channels, roomAgents, hub.unread],
    )
    const panels = useOfficePanels(messages ?? [], board, words, waiting.length, panelRoom)
    return { waiting, panels }
}
