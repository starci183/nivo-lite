import {
    AvatarButton,
    Button,
    DropdownMenu,
    IconButton,
    NavLandmark,
    Switch,
    Text,
    TopBar,
} from "@starci/grammar/common"
import { languageMenuEntries } from "../../composites/LanguageMenu"
import { nivoIconSource } from "../../leaves/Icon"

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
    }
    readonly on: {
        readonly chooseLocale: (locale: string) => void
        readonly chooseDark: (isDark: boolean) => void
        readonly signOut: () => void
    }
}

/** Draws the console bar: the title, the destinations (the open one raised), then language, appearance and the account menu with sign out. */
export const AdminHeaderBase = (props: AdminHeaderBaseProps) => (
    <TopBar
        brand={<Text isStrong>{props.props.title}</Text>}
        actions={
            <>
                <DropdownMenu
                    placement="bottom end"
                    entries={languageMenuEntries({
                        label: props.props.languageLabel,
                        value: props.props.locale,
                        options: props.props.localeOptions,
                        isDisabled: props.props.isLocalePending,
                        onChange: props.on.chooseLocale,
                    })}
                    trigger={
                        <IconButton
                            source={nivoIconSource("locale", "leading")}
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
                    thumbIcon={nivoIconSource("light", "leading")}
                    selectedThumbIcon={nivoIconSource("dark", "leading")}
                />
                <DropdownMenu
                    placement="bottom end"
                    entries={[
                        {
                            kind: "section",
                            id: "account",
                            items: [
                                {
                                    id: "admin-account",
                                    label: props.props.email,
                                    description: props.props.accountDescription,
                                },
                                {
                                    id: "signout",
                                    label: props.props.signOutLabel,
                                    iconSource: nivoIconSource("signOut", "leading"),
                                    tone: "danger",
                                    onAction: props.on.signOut,
                                },
                            ],
                        },
                    ]}
                    trigger={<AvatarButton size="control" name={props.props.email} seed={props.props.email} />}
                />
            </>
        }
        subnavigation={
            <NavLandmark label={props.props.navigationLabel} layout="bar">
                {props.props.destinations.map((item) => (
                    <Button
                        key={item.id}
                        size="sm"
                        intent={item.isCurrent ? "alternative" : "neutral"}
                        href={item.href}
                    >
                        {item.label}
                    </Button>
                ))}
            </NavLandmark>
        }
        subnavigationLabel={props.props.navigationLabel}
    />
)
