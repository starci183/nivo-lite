import {
    AvatarButton,
    Button,
    Drawer,
    DropdownMenu,
    Icon,
    IconButton,
    NavLandmark,
    Switch,
    Text,
    TopBar,
} from "@starci/grammar/common"
import { adminLanguageMenuEntries } from "../../composites/LanguageMenu"
import { adminIconSource } from "../../leaves/Icon"

/** One destination of the console bar. */
export interface AdminHeaderDestination {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly isCurrent: boolean
}

/** Everything the console bar draws, resolved by the connected block. */
export interface AdminHeaderBaseProps {
    readonly props: {
        readonly title: string
        readonly email: string
        readonly accountDescription: string
        readonly signOutLabel: string
        readonly navigationLabel: string
        readonly destinations: ReadonlyArray<AdminHeaderDestination>
        readonly languageLabel: string
        readonly locale: string
        readonly isLocalePending: boolean
        readonly localeOptions: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        readonly themeLabel: string
        readonly isDark: boolean
        readonly openMenuLabel: string
        readonly closeMenuLabel: string
        readonly isMenuOpen: boolean
    }
    readonly on: {
        readonly chooseLocale: (locale: string) => void
        readonly chooseDark: (isDark: boolean) => void
        readonly signOut: () => void
        readonly setMenuOpen: (isOpen: boolean) => void
    }
}

/** The destinations as buttons, the open one raised. */
const Destinations = (props: Pick<AdminHeaderBaseProps, "props">) => (
    <NavLandmark label={props.props.navigationLabel} layout="bar">
        {props.props.destinations.map((item) => (
            <Button key={item.id} size="sm" intent={item.isCurrent ? "alternative" : "neutral"} href={item.href}>
                {item.label}
            </Button>
        ))}
    </NavLandmark>
)

/** The language menu, the appearance switch and the account menu with sign out. */
const Actions = (props: AdminHeaderBaseProps) => (
    <>
        <DropdownMenu
            placement="bottom end"
            entries={adminLanguageMenuEntries({
                label: props.props.languageLabel,
                value: props.props.locale,
                options: props.props.localeOptions,
                isDisabled: props.props.isLocalePending,
                onChange: props.on.chooseLocale,
            })}
            trigger={
                <IconButton
                    source={adminIconSource("locale", "leading")}
                    label={props.props.languageLabel}
                    intent="dismiss"
                    isDisabled={props.props.isLocalePending}
                />
            }
        />
        <Switch
            label={props.props.themeLabel}
            isLabelHidden
            size="control"
            isSelected={props.props.isDark}
            onSelectedChange={props.on.chooseDark}
            thumbIcon={adminIconSource("light", "leading")}
            selectedThumbIcon={adminIconSource("dark", "leading")}
        />
        <DropdownMenu
            placement="bottom end"
            entries={[
                {
                    kind: "section",
                    id: "account",
                    items: [
                        { id: "admin-account", label: props.props.email, description: props.props.accountDescription },
                        {
                            id: "signout",
                            label: props.props.signOutLabel,
                            iconSource: adminIconSource("signOut", "leading"),
                            tone: "danger",
                            onAction: props.on.signOut,
                        },
                    ],
                },
            ]}
            trigger={<AvatarButton size="control" name={props.props.email} seed={props.props.email} />}
        />
    </>
)

/** Draws the console bar: the title, the destinations in the row (a menu holds them on a phone), then language, appearance and the account menu with sign out. */
export const AdminHeaderBase = (props: AdminHeaderBaseProps) => (
    <>
        <TopBar
            brand={<Text isStrong>{props.props.title}</Text>}
            navigation={<Destinations props={props.props} />}
            menu={{
                icon: <Icon source={adminIconSource("menu", "leading")} />,
                openLabel: props.props.openMenuLabel,
                closeLabel: props.props.closeMenuLabel,
                isOpen: props.props.isMenuOpen,
                onOpenChange: props.on.setMenuOpen,
                visibility: "compact",
            }}
            actions={<Actions {...props} />}
        />
        <Drawer
            isOpen={props.props.isMenuOpen}
            onOpenChange={props.on.setMenuOpen}
            title={props.props.title}
            closeLabel={props.props.closeMenuLabel}
            placement="left"
        >
            <Destinations props={props.props} />
        </Drawer>
    </>
)
