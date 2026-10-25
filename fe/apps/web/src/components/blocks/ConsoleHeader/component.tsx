import type { DropdownMenuEntry } from "@starci/grammar/common"
import { NavigationFeatureNav } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { ConsoleAccountMenu } from "../../composites/ConsoleAccountMenu"
import { ConsoleNotifications } from "../../composites/ConsoleNotifications"
import { ConsoleSearch } from "../../composites/ConsoleSearch"
import { LanguageMenu } from "../../composites/LanguageMenu"
import { ConsoleWorkspaceMenu } from "../../composites/ConsoleWorkspaceMenu"
import { FoundingBadge } from "../../composites/FoundingBadge"
import { ThemeSwitch } from "../../composites/ThemeSwitch"
import { ACTIONS, BADGE, BRAND, SWITCHES } from "./classNames"

/** Everything the console top bar draws, resolved by the connected block. */
export interface ConsoleHeaderBaseProps {
    readonly props: {
        readonly workspaceName: string
        readonly menuLabel: string
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

const Actions = ({ props, on }: ConsoleHeaderBaseProps) => (
    <div className={ACTIONS}>
        <ConsoleSearch part="icon" {...searchProps(props, on)} />
        <div className={SWITCHES}>
            <LanguageMenu
                label={props.languageLabel}
                value={props.locale}
                options={props.localeOptions}
                isDisabled={props.isLocalePending}
                onChange={on.chooseLocale}
            />
            <ThemeSwitch isDark={props.isDark} label={props.themeLabel} onChange={on.chooseDark} />
        </div>
        <ConsoleNotifications
            count={Math.max(props.pendingCount, 0)}
            pending={props.pending}
            copy={props.notificationsCopy}
            isOpen={props.isNotificationsOpen}
            onOpenChange={on.setNotificationsOpen}
            onOpenOffice={on.openOffice}
        />
        <ConsoleAccountMenu
            userName={props.userName}
            userSeed={props.userId}
            avatarUrl={props.avatarUrl}
            entries={props.accountEntries}
        />
    </div>
)

/** Draws the console top bar: the menu and workspace lockup on the left; search, language, appearance, bell and account on the right; the compact tab row under it. */
export const ConsoleHeaderBase = (props: ConsoleHeaderBaseProps) => (
    <NavigationFeatureNav
        position="sticky"
        identity={<Brand {...props} />}
        navigation={<ConsoleSearch part="field" {...searchProps(props.props, props.on)} />}
        navigationLabel={props.props.searchLabel}
        compactNavigationTrigger={null}
        compactNavigationTriggerLabel={props.props.menuLabel}
        actions={<Actions {...props} />}
        actionsLabel={props.props.actionsLabel}
    />
)
