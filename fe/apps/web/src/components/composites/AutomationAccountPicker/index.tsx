import { Select } from "@starci/grammar/common"

/** One Google account the spreadsheet can be written with. */
type AutomationAccountOption = {
    readonly id: string
    readonly label: string
    readonly isDisabled: boolean
}

/** What the account picker shows, already in the reader language. */
type AutomationAccountPickerProps = {
    readonly label: string
    readonly description: string
    readonly options: ReadonlyArray<AutomationAccountOption>
    readonly value: string | null
    readonly isPending: boolean
    readonly onPick: (id: string) => void
}

/** Which Google account a Sheets automation writes with; a pick of the account already in use changes nothing. */
export const AutomationAccountPicker = (props: AutomationAccountPickerProps) => (
    <Select
        label={props.label}
        description={props.description}
        options={props.options}
        value={props.value}
        isPending={props.isPending}
        onValueChange={(id) => {
            if (id && id !== props.value) props.onPick(id)
        }}
    />
)
