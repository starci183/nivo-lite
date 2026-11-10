import { Alert, Dialog, EmptyNotice, ListBox, Stack } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import type { TeamChatForwardView } from "@/modules/types"

/** The rooms to forward a message to, and what the dialog does with the pick. */
interface TeamChatForwardProps {
    readonly view: TeamChatForwardView
    readonly onClose: () => void
    readonly onPick: (roomId: string) => void
}

/** The dialog that picks the room a message goes to: the viewer's other rooms, one press forwards. */
export const TeamChatForward = (props: TeamChatForwardProps) => {
    const { view } = props
    return (
        <Dialog
            isOpen={view.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.onClose()
            }}
            title={view.title}
            description={view.description}
            closeLabel={view.closeLabel}
            size="sm"
        >
            <Stack gap="row">
                {view.error === null ? null : <Alert tone="negative" title={view.error} />}
                {view.rooms.length === 0 ? (
                    <EmptyNotice message={view.empty} />
                ) : (
                    <ListBox
                        label={view.title}
                        selectionMode="none"
                        onAction={props.onPick}
                        items={view.rooms.map((room) => ({
                            id: room.id,
                            label: room.title,
                            description: room.subtitle,
                            leading: <ChatPartyMark mark={room.mark} />,
                            isDisabled: view.sendingId !== null,
                        }))}
                    />
                )}
            </Stack>
        </Dialog>
    )
}
