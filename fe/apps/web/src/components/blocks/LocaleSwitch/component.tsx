import { ChoiceChips } from "@starci/grammar/common"

/** The words, options and state of the language switch, resolved by the connected block. */
export interface LocaleSwitchBaseProps {
    readonly props: {
        readonly label: string
        readonly locale: string
        readonly isPending: boolean
        readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
    }
    readonly on: { readonly choose: (locale: string) => void }
}

/** Draws the language switch from resolved options: the short codes (VI, EN) as one pair of chips with the chosen one checked, as the sign-in and workspaces artboards show. */
export const LocaleSwitchBase = (props: LocaleSwitchBaseProps) => (
    <ChoiceChips
        label={props.props.label}
        isLabelHidden
        options={props.props.options.map((option) => ({
            value: option.value,
            label: option.label,
            isDisabled: props.props.isPending,
        }))}
        value={props.props.locale}
        onValueChange={props.on.choose}
        empty={null}
    />
)
