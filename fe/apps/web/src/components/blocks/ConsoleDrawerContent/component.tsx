import { Cluster } from "@starci/grammar/common"
import type { ConsoleNavItem } from "@/modules/types"
import { ConsoleSidebar } from "../../composites/ConsoleSidebar"
import { LanguageMenu } from "../../composites/LanguageMenu"
import { ThemeSwitch } from "../../composites/ThemeSwitch"

/** The destinations, words and state of the compact navigation drawer, resolved by the connected block. */
export interface ConsoleDrawerContentBaseProps {
    readonly props: {
        readonly items: ReadonlyArray<ConsoleNavItem>
        readonly label: string
        readonly groupLabels: { readonly operate: string; readonly setup: string }
        readonly languageLabel: string
        readonly locale: string
        readonly isLocalePending: boolean
        readonly localeOptions: ReadonlyArray<{ readonly value: string; readonly name: string }>
        readonly themeLabel: string
        readonly isDark: boolean
    }
    readonly on: {
        readonly go: (href: string) => void
        readonly chooseLocale: (locale: string) => void
        readonly chooseDark: (isDark: boolean) => void
    }
}

/** Draws the navigation drawer body: the language and appearance controls ride the grammar sidebar's header slot above the same destinations as the wide rail. */
export const ConsoleDrawerContentBase = (props: ConsoleDrawerContentBaseProps) => (
    <ConsoleSidebar
        items={props.props.items}
        label={props.props.label}
        presentation="drawer"
        groupLabels={props.props.groupLabels}
        header={
            <Cluster gap="inline" wrap={false}>
                <LanguageMenu
                    label={props.props.languageLabel}
                    value={props.props.locale}
                    options={props.props.localeOptions}
                    isDisabled={props.props.isLocalePending}
                    onChange={props.on.chooseLocale}
                />
                <ThemeSwitch
                    isDark={props.props.isDark}
                    label={props.props.themeLabel}
                    onChange={props.on.chooseDark}
                />
            </Cluster>
        }
        onGo={props.on.go}
    />
)
