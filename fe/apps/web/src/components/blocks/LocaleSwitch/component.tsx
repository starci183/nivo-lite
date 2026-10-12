import { LocaleSegments } from "../../composites/LocaleSegments"

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

/** Draws the language switch from resolved options. */
export const LocaleSwitchBase = (props: LocaleSwitchBaseProps) => (
    <LocaleSegments
        label={props.props.label}
        value={props.props.locale}
        options={props.props.options}
        isDisabled={props.props.isPending}
        onChange={props.on.choose}
    />
)
