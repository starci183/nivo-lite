import { Button, DropdownMenu } from "@starci/grammar/common"
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

/** The actions slot of the top bar: the language menu, sign-in and try. */
export const LandingNavActionsBase = (props: LandingNavActionsBaseProps) => {
    const { language } = props.props
    const current = language.options.find((option) => option.value === language.locale)
    return (
        <>
            <DropdownMenu
                placement="bottom end"
                entries={[
                    {
                        kind: "section",
                        id: "language",
                        label: language.label,
                        items: language.options.map((option) => ({ id: option.value, label: option.name })),
                        selection: {
                            mode: "single",
                            selectedIds: [language.locale],
                            onChange: (ids) => {
                                const next = ids[0]
                                if (next !== undefined) props.on.chooseLocale(next)
                            },
                        },
                    },
                ]}
                trigger={
                    <Button intent="dismiss" isDisabled={language.isPending}>
                        {current?.label ?? language.locale}
                    </Button>
                }
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
}
