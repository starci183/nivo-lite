import { DropdownMenu, IconButton, type DropdownMenuEntry, type DropdownMenuItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkspaceMenuCommand, WorkspaceMenuView } from "@/modules/types"

/** The workspace row menu: the view and the callbacks. */
interface WorkspaceRowMenuProps {
    readonly props: WorkspaceMenuView
    readonly on: { readonly command: (command: WorkspaceMenuCommand) => void }
}

/** The entries the person may use: the allowed ones only, with the danger group after a separator (a section). */
const entriesOf = (view: WorkspaceMenuView, on: WorkspaceRowMenuProps["on"]): ReadonlyArray<DropdownMenuEntry> => {
    const common: DropdownMenuItem[] = [
        { id: "open", label: view.openLabel, onAction: () => on.command("open") },
        { id: "billing", label: view.billingLabel, onAction: () => on.command("billing") },
    ]
    if (view.canRename) common.push({ id: "rename", label: view.renameLabel, onAction: () => on.command("rename") })
    if (view.canInvite)
        common.push({ id: "copyLink", label: view.copyLinkLabel, onAction: () => on.command("copyLink") })
    const danger: DropdownMenuItem[] = []
    if (view.canLeave)
        danger.push({ id: "leave", label: view.leaveLabel, tone: "danger", onAction: () => on.command("leave") })
    danger.push({
        id: "delete",
        label: view.deleteLabel,
        tone: "danger",
        isDisabled: !view.canDelete,
        ...(view.canDelete ? {} : { description: view.deleteNote }),
        onAction: () => on.command("delete"),
    })
    return [
        { kind: "section", id: "main", items: common },
        { kind: "section", id: "danger", items: danger },
    ]
}

/** The ⋯ menu of one workspace row: open, billing, rename, copy invite link, then leave and delete. */
export const WorkspaceRowMenu = (props: WorkspaceRowMenuProps) => (
    <DropdownMenu
        placement="bottom end"
        entries={entriesOf(props.props, props.on)}
        trigger={
            <IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={props.props.menuLabel} />
        }
    />
)
