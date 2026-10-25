import { AvatarButton, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ACCOUNT_ITEM, SIGN_OUT_ITEM } from "@/modules/types"
import { nivoIconSource } from "../../leaves/Icon"
import { avatarPictureOf } from "../../leaves/PersonAvatar"

/** The glyph and tone of the account menu's two commands, keyed by the ids `modules/types` shares with the entries builder. */
const COMMAND_LOOKS: Record<
    string,
    { readonly iconSource: ReturnType<typeof nivoIconSource>; readonly tone?: "negative" }
> = {
    [ACCOUNT_ITEM]: { iconSource: nivoIconSource("account", "leading") },
    [SIGN_OUT_ITEM]: { iconSource: nivoIconSource("signOut", "leading"), tone: "negative" },
}

/** Gives the account page and sign-out items their leading glyph (sign out marked destructive). */
const withLooks = (entries: ReadonlyArray<DropdownMenuEntry>): ReadonlyArray<DropdownMenuEntry> =>
    entries.map((entry) =>
        entry.kind === "section"
            ? { ...entry, items: entry.items.map((item) => ({ ...item, ...COMMAND_LOOKS[item.id] })) }
            : { ...entry, ...COMMAND_LOOKS[entry.id] },
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
            <AvatarButton size="control" name={props.userName} {...avatarPictureOf(props.avatarUrl, props.userSeed)} />
        }
    />
)
