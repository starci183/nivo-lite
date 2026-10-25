import type { DropdownMenuEntry, DropdownMenuItem } from "@starci/grammar/common"
import { AvatarButton, DropdownMenu, IconButton, NavigationFeatureNav, Popover, Switch } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { ACCOUNT_ITEM, SIGN_OUT_ITEM } from "@/modules/types"
import { ConsoleNotificationsPanel } from "../../composites/ConsoleNotificationsPanel"
import { ConsoleSearch } from "../../composites/ConsoleSearch"
import { ConsoleWorkspaceMenu } from "../../composites/ConsoleWorkspaceMenu"
import { FoundingBadge } from "../../composites/FoundingBadge"
import { languageMenuEntries } from "../../composites/LanguageMenu"
import { nivoIconSource } from "../../leaves/Icon"
import { ACTIONS, BADGE, BRAND, SWITCHES } from "./classNames"

/** Everything the console top bar draws, resolved by the connected block. */
export interface ConsoleHeaderBaseProps {
    readonly props: {
        readonly workspaceName: string
        readonly actionsLabel: string
        /** The workspace logo (brand kit), shown in the lockup; null shows the monogram. */
        readonly workspaceLogoUrl: string | null
        readonly userName: string
        readonly userId: string
        readonly avatarUrl?: string | undefined
        readonly roleLabel: string
        readonly isFoundingMember: boolean
        readonly foundingLabel: string
        readonly workspaceEntries: ReadonlyArray<DropdownMenuEntry>
        readonly accountEntries: ReadonlyArray<DropdownMenuEntry>
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly searchShortcut: string
        readonly closeLabel: string
        readonly query: string
        readonly isSearchOpen: boolean
        readonly languageLabel: string
        readonly locale: string
        readonly isLocalePending: boolean
        readonly localeOptions: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        readonly themeLabel: string
        readonly isDark: boolean
        readonly pending: ReadonlyArray<ConsolePending>
        readonly pendingCount: number
        readonly isNotificationsOpen: boolean
        readonly notificationsCopy: {
            readonly bell: string
            readonly title: string
            readonly nothingWaiting: string
            readonly openOffice: string
        }
    }
    readonly on: {
        readonly setQuery: (query: string) => void
        readonly setSearchOpen: (isOpen: boolean) => void
        readonly search: (query: string) => void
        readonly chooseLocale: (locale: string) => void
        readonly chooseDark: (isDark: boolean) => void
        readonly setNotificationsOpen: (isOpen: boolean) => void
        readonly openOffice: () => void
    }
}

type BrandProps = Pick<ConsoleHeaderBaseProps, "props">

const Brand = ({ props }: BrandProps) => (
    <div className={BRAND}>
        <ConsoleWorkspaceMenu
            workspaceName={props.workspaceName}
            logoUrl={props.workspaceLogoUrl}
            roleLabel={props.roleLabel}
            entries={props.workspaceEntries}
        />
        <div className={BADGE}>
            <FoundingBadge isFoundingMember={props.isFoundingMember} label={props.foundingLabel} />
        </div>
    </div>
)

/** The props both parts of the search share. */
const searchProps = (props: ConsoleHeaderBaseProps["props"], on: ConsoleHeaderBaseProps["on"]) => ({
    label: props.searchLabel,
    placeholder: props.searchPlaceholder,
    shortcut: props.searchShortcut,
    closeLabel: props.closeLabel,
    query: props.query,
    isOpen: props.isSearchOpen,
    onOpenChange: on.setSearchOpen,
    onQueryChange: on.setQuery,
    onSubmit: on.search,
})

/** The glyph and tone of the account menu's two commands, keyed by the ids `modules/types` shares with the entries builder. */
const COMMAND_LOOKS: Record<
    string,
    { readonly iconSource: ReturnType<typeof nivoIconSource>; readonly tone?: "danger" }
> = {
    [ACCOUNT_ITEM]: { iconSource: nivoIconSource("account", "leading") },
    [SIGN_OUT_ITEM]: { iconSource: nivoIconSource("signOut", "leading"), tone: "danger" },
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

const Actions = ({ props, on }: ConsoleHeaderBaseProps) => (
    <div className={ACTIONS}>
        <div className={SWITCHES}>
            <DropdownMenu
                placement="bottom end"
                entries={languageMenuEntries({
                    label: props.languageLabel,
                    value: props.locale,
                    options: props.localeOptions,
                    isDisabled: props.isLocalePending,
                    onChange: on.chooseLocale,
                })}
                trigger={
                    <IconButton
                        source={nivoIconSource("locale", "leading")}
                        label={props.languageLabel}
                        variant="tertiary"
                        size="control"
                        isDisabled={props.isLocalePending}
                    />
                }
            />
            <Switch
                label={props.themeLabel}
                isLabelHidden
                size="control"
                isSelected={props.isDark}
                onSelectedChange={on.chooseDark}
                thumbIcon={nivoIconSource("light", "leading")}
                selectedThumbIcon={nivoIconSource("dark", "leading")}
            />
        </div>
        <Popover
            isOpen={props.isNotificationsOpen}
            onOpenChange={on.setNotificationsOpen}
            placement="bottom"
            title={props.notificationsCopy.title}
            trigger={
                <IconButton
                    source={nivoIconSource("notification", "leading")}
                    label={props.notificationsCopy.bell}
                    badge={Math.max(props.pendingCount, 0)}
                    badgeLabel={props.notificationsCopy.title}
                    size="control"
                />
            }
        >
            <ConsoleNotificationsPanel
                count={Math.max(props.pendingCount, 0)}
                pending={props.pending}
                copy={props.notificationsCopy}
                onClose={() => on.setNotificationsOpen(false)}
                onOpenOffice={on.openOffice}
            />
        </Popover>
        <DropdownMenu
            placement="bottom end"
            entries={withLooks(props.accountEntries)}
            trigger={
                <AvatarButton
                    size="control"
                    name={props.userName}
                    seed={props.userId}
                    {...(props.avatarUrl ? { src: props.avatarUrl } : {})}
                />
            }
        />
    </div>
)

/** Draws the console top bar: the workspace lockup on the left; the search field in the middle (an icon on a phone); language, appearance, bell and account on the right; the compact tab row under it. */
export const ConsoleHeaderBase = (props: ConsoleHeaderBaseProps) => (
    <NavigationFeatureNav
        position="sticky"
        identity={<Brand {...props} />}
        navigation={<ConsoleSearch part="field" {...searchProps(props.props, props.on)} />}
        navigationLabel={props.props.searchLabel}
        compactNavigationTrigger={<ConsoleSearch part="icon" {...searchProps(props.props, props.on)} />}
        compactNavigationTriggerLabel={props.props.searchLabel}
        actions={<Actions {...props} />}
        actionsLabel={props.props.actionsLabel}
    />
)
