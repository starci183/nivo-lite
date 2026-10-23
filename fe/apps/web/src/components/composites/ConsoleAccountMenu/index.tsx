import { Button, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { PersonAvatar } from "../../leaves/PersonAvatar"

/** What the account button draws and opens. */
type ConsoleAccountMenuProps = {
    readonly userName: string
    readonly avatarUrl?: string | undefined
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The person menu in the top bar: the avatar opens the workspaces, the account and sign out. */
export const ConsoleAccountMenu = (props: ConsoleAccountMenuProps) => (
    <DropdownMenu
        placement="bottom end"
        entries={props.entries}
        trigger={
            <Button variant="ghost" size="sm">
                <PersonAvatar name={props.userName} src={props.avatarUrl} size="sm" />
            </Button>
        }
    />
)
