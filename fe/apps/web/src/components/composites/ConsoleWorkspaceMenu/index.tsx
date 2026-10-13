import { Button, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"

/** What the workspace name button draws and opens. */
type ConsoleWorkspaceMenuProps = {
    readonly workspaceName: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The workspace name in the top bar: a quiet button that opens the list of workspaces to switch to. */
export const ConsoleWorkspaceMenu = (props: ConsoleWorkspaceMenuProps) => (
    <DropdownMenu
        placement="bottom start"
        entries={props.entries}
        trigger={
            <Button variant="ghost" size="sm">
                {props.workspaceName}
            </Button>
        }
    />
)
