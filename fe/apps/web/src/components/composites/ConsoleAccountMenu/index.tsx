import { AvatarButton, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry, DropdownMenuItem } from "@starci/grammar/common"
import { nivoIconSource } from "../../leaves/Icon"

/** The glyph and tone of the account menu's two commands, by their ids. */
const COMMAND_LOOKS: Record<
    string,
    { readonly iconSource: ReturnType<typeof nivoIconSource>; readonly tone?: "danger" }
> = {
    "account-page": { iconSource: nivoIconSource("account", "leading") },
    signout: { iconSource: nivoIconSource("signIn", "leading"), tone: "danger" },
}

/** Gives a known command its glyph without keeping an identity mark in the same slot. */
const withCommandLook = (item: DropdownMenuItem): DropdownMenuItem => {
    const look = COMMAND_LOOKS[item.id]
    if (look === undefined) return item
    const { mark: _mark, ...command } = item
    return { ...command, ...look }
}

/** Gives the account page and sign-out items their leading glyph (sign out marked destructive). */
const withLooks = (entries: ReadonlyArray<DropdownMenuEntry>): ReadonlyArray<DropdownMenuEntry> =>
    entries.map((entry) =>
        entry.kind === "section" ? { ...entry, items: entry.items.map(withCommandLook) } : withCommandLook(entry),
    )

/** What the account button draws and opens. */
type ConsoleAccountMenuProps = {
    readonly userName: string
    readonly avatarUrl?: string | undefined
    /** The person's id: seeds the generated avatar when there is no uploaded one. */
    readonly userSeed: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The person menu in the top bar: the round avatar opens the workspaces, the account and sign out. */
export const ConsoleAccountMenu = (props: ConsoleAccountMenuProps) => (
    <DropdownMenu
        placement="bottom end"
        entries={withLooks(props.entries)}
        trigger={
            <AvatarButton
                size="control"
                name={props.userName}
                seed={props.userSeed}
                {...(props.avatarUrl ? { src: props.avatarUrl } : {})}
            />
        }
    />
)
