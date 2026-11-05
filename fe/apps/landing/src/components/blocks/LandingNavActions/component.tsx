import { Button, ChoiceChips } from "@starci/grammar/common"
import { NAV_SIGNIN } from "./classNames"

/** The language switch and the sign-in and try actions. */
interface LandingNavActionsBaseProps {
    readonly props: {
        readonly accountHref: string
        readonly accountLabel: string
        readonly tryHref: string
        readonly tryLabel: string
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
    }
    readonly on: {
        readonly chooseLocale: (locale: string) => void
    }
}

/** The actions slot of the top bar: language switch, sign-in and try. The switch gets size="control" once Grammar carries it. */
export const LandingNavActionsBase = (props: LandingNavActionsBaseProps) => (
    <>
        <ChoiceChips
            label={props.props.language.label}
            isLabelHidden
            value={props.props.language.locale}
            empty={props.props.language.label}
            onValueChange={props.on.chooseLocale}
            options={props.props.language.options.map((option) => ({
                value: option.value,
                label: option.label,
                isDisabled: props.props.language.isPending,
                disabledReason: option.name,
            }))}
        />
        <div className={NAV_SIGNIN}>
            <Button intent="neutral" href={props.props.accountHref}>
                {props.props.accountLabel}
            </Button>
        </div>
        <Button intent="alternative" href={props.props.tryHref}>
            {props.props.tryLabel}
        </Button>
    </>
)
