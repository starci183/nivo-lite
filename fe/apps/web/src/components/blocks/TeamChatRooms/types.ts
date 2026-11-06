import type { TeamChatNewChatProps } from "@/components/composites/TeamChatNewChat"
import type { DataSlot, SlotLabels, TeamChatRoomRow } from "@/modules/types"

/** The words of the list of rooms. */
export interface TeamChatRoomsCopy {
    readonly title: string
    readonly listLabel: string
    readonly newChat: string
    readonly refresh: string
    readonly groupLine: string
    readonly roomsEmpty: string
    readonly roomsEmptyAction: string
    readonly errorBody: string
}

/** What the list of rooms draws, already resolved. */
export interface TeamChatRoomsViewProps {
    readonly copy: TeamChatRoomsCopy
    readonly labels: SlotLabels
    readonly slot: DataSlot<ReadonlyArray<TeamChatRoomRow>>
    readonly selectedId: string | null
    readonly newChat: Omit<
        TeamChatNewChatProps,
        "onOpenChange" | "onDirect" | "onGroupName" | "onGroupMembers" | "onStartDirect" | "onCreateGroup"
    >
}

/** What the list of rooms asks of its owner. */
export interface TeamChatRoomsHandlers {
    readonly refresh: () => void
    readonly select: (roomId: string) => void
    readonly openNewChat: () => void
    readonly newChatOpenChange: (isOpen: boolean) => void
    readonly newChatDirect: (value: string | null) => void
    readonly newChatGroupName: (value: string) => void
    readonly newChatGroupMembers: (value: ReadonlyArray<string>) => void
    readonly newChatStartDirect: () => void
    readonly newChatCreateGroup: () => void
}

/** Props for the pure half of the list of rooms. */
export interface TeamChatRoomsBaseProps {
    readonly props: TeamChatRoomsViewProps
    readonly on: TeamChatRoomsHandlers
}
