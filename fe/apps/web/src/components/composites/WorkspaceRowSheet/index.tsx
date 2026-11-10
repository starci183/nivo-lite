import { Avatar, Button, Drawer, IconButton, ListBox, Stack, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkspaceMenuCommand, WorkspaceRowSheetView } from "@/modules/types"

/** The phone sheet of one workspace row: the view and the callbacks. */
interface WorkspaceRowSheetProps {
    readonly props: WorkspaceRowSheetView
    readonly on: {
        /** A command of the sheet, given once the sheet has closed. */
        readonly command: (command: WorkspaceMenuCommand) => void
        /** The sheet asks to open or close; the container keeps the open state. */
        readonly openChange: (isOpen: boolean) => void
    }
}

/** The plain commands the person may use, in the order of the desktop menu. */
const itemsOf = (view: WorkspaceRowSheetView): ReadonlyArray<ListBoxItem> => {
    const { menu } = view
    const items: ListBoxItem[] = [
        { id: "open", label: menu.openLabel },
        { id: "billing", label: menu.billingLabel },
    ]
    if (menu.canRename) items.push({ id: "rename", label: menu.renameLabel })
    if (menu.canInvite) items.push({ id: "copyLink", label: menu.copyLinkLabel })
    return items
}

const PLAIN_COMMANDS: ReadonlyArray<WorkspaceMenuCommand> = ["open", "billing", "rename", "copyLink"]

/** The command a list item names; an unknown id opens the workspace. */
const commandOf = (id: string): WorkspaceMenuCommand => PLAIN_COMMANDS.find((command) => command === id) ?? "open"

/** The ⋯ control of a workspace row on a phone: it opens a bottom sheet with the workspace identity and its commands. */
export const WorkspaceRowSheet = (props: WorkspaceRowSheetProps) => {
    const { on } = props
    const view = props.props
    const { menu } = view
    /** Closes the sheet, then gives the command. */
    const run = (command: WorkspaceMenuCommand) => () => {
        on.openChange(false)
        on.command(command)
    }
    return (
        <Drawer
            placement="bottom"
            isOpen={view.isOpen}
            onOpenChange={on.openChange}
            title={view.name}
            description={view.meta}
            closeLabel={view.closeLabel}
            leading={<Avatar name={view.name} seed={view.id} shape="rounded" size="md" />}
            trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={menu.menuLabel} />}
        >
            <Stack gap="section">
                <ListBox
                    label={view.name}
                    items={itemsOf(view)}
                    selectionMode="none"
                    onAction={(id) => run(commandOf(id))()}
                />
                <Stack gap="identity" align="start">
                    {menu.canLeave ? (
                        <Button intent="destructive" step="entry" onPress={run("leave")}>
                            {menu.leaveLabel}
                        </Button>
                    ) : null}
                    <Button intent="destructive" step="entry" isDisabled={!menu.canDelete} onPress={run("delete")}>
                        {menu.deleteLabel}
                    </Button>
                    {menu.canDelete ? null : (
                        <Text size="xs" tone="muted">
                            {menu.deleteNote}
                        </Text>
                    )}
                </Stack>
            </Stack>
        </Drawer>
    )
}
