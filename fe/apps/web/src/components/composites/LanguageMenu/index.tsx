import type { ReactElement } from "react"
import { type DropdownMenuEntry, Button, DropdownMenu, Icon, IconButton } from "@starci/grammar/common"
import { nivoIconSource } from "../../leaves/Icon"
import { NAME_ONLY_CLASS_NAME, PHONE_ONLY_CLASS_NAME } from "./classNames"

/** One language the menu offers: its code and spoken name. */
type LanguageMenuOption = {
    readonly value: string
    readonly name: string
}

/** What the language menu draws and reports. */
type LanguageMenuProps = {
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<LanguageMenuOption>
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
    /** Wide screens name the chosen language beside the globe (a phone keeps the globe alone). */
    readonly isNamed?: boolean
}

/** The single-select list of spoken languages with the chosen one checked; the bar's menu and the drawer's menu both open it. */
export const languageMenuEntries = (props: LanguageMenuProps): ReadonlyArray<DropdownMenuEntry> => [
    {
        kind: "section",
        id: "language",
        label: props.label,
        items: props.options.map((option) => ({ id: option.value, label: option.name })),
        selection: {
            mode: "single",
            selectedIds: [props.value],
            onChange: (ids) => {
                const next = ids[0]
                if (next !== undefined && !props.isDisabled) props.onChange(next)
            },
        },
    },
]

/** The language menu: a globe button that opens a single-select list with the chosen language checked; `isNamed` adds the language's name on a wide screen. */
export const LanguageMenu = (props: LanguageMenuProps): ReactElement => {
    const entries = languageMenuEntries(props)
    const chosen = props.options.find((option) => option.value === props.value)?.name ?? props.label
    const globe = (
        <DropdownMenu
            placement="bottom end"
            entries={entries}
            trigger={
                <IconButton
                    source={nivoIconSource("locale", "leading")}
                    label={props.label}
                    intent="dismiss"
                    isDisabled={props.isDisabled}
                />
            }
        />
    )
    if (props.isNamed !== true) return globe
    return (
        <>
            <div className={PHONE_ONLY_CLASS_NAME}>{globe}</div>
            <div className={NAME_ONLY_CLASS_NAME}>
                <DropdownMenu
                    placement="bottom end"
                    entries={entries}
                    trigger={
                        <Button
                            intent="dismiss"
                            size="md"
                            isDisabled={props.isDisabled}
                            startContent={<Icon source={nivoIconSource("locale", "leading")} usage="leading" />}
                        >
                            {chosen}
                        </Button>
                    }
                />
            </div>
        </>
    )
}
