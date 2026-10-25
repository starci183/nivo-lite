import { DropdownMenu, IdentityLockup } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"

/** What the workspace lockup draws and opens. */
type ConsoleWorkspaceMenuProps = {
    readonly workspaceName: string
    /** The uploaded workspace logo; the initials of the name stand in without one. */
    readonly logoUrl: string | null
    readonly roleLabel: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The workspace lockup in the top bar: logo or monogram beside the name over the role; it opens the list of workspaces. */
export const ConsoleWorkspaceMenu = (props: ConsoleWorkspaceMenuProps) => (
    <DropdownMenu
        placement="bottom start"
        entries={props.entries}
        trigger={
            <IdentityLockup
                title={props.workspaceName}
                subtitle={props.roleLabel}
                {...(props.logoUrl === null ? {} : { logoSrc: props.logoUrl })}
            />
        }
    />
)
