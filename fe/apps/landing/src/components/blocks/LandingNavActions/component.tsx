import { Button, ChoiceChips } from "@starci/grammar/common"
import { NAV_LANGUAGE, NAV_SIGNIN } from "./classNames"

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

/** The actions slot of the top bar: the language chips (wide only; a phone has them in the drawer), sign-in and try. */
export const LandingNavActionsBase = (props: LandingNavActionsBaseProps) => (
    <>
        <div className={NAV_LANGUAGE}>
            <ChoiceChips
                label={props.props.language.label}
                isLabelHidden
                options={props.props.language.options.map((option) => ({ value: option.value, label: option.label }))}
                value={props.props.language.locale}
                onValueChange={props.on.chooseLocale}
                empty={null}
            />
        </div>
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
