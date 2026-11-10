import type { DropdownMenuEntry } from "@starci/grammar/common"

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
