import { Button } from "@starci/grammar/common"

/** One button of a wizard step: the way forward is the one next step, the way out dismisses. */
export type WizardAction = {
    readonly id: string
    readonly label: string
    readonly intent: "alternative" | "dismiss" | "neutral"
    /** The one way forward of the step: the footer draws it as the commit. */
    readonly isNext?: true
    readonly onPress: () => void
    readonly isPending?: boolean
    readonly isDisabled?: boolean
}

/** What the footer of a wizard step draws. */
type WizardFooterProps = {
    readonly actions: ReadonlyArray<WizardAction>
}

/** The flags a wizard action may carry onto its button. */
const flagsOf = (action: WizardAction) => ({
    ...(action.isPending === undefined ? {} : { isPending: action.isPending }),
    ...(action.isDisabled === undefined ? {} : { isDisabled: action.isDisabled }),
})

/** The buttons of a wizard step: the commit first when the step has a way forward, then the others in the order given. */
export const WizardFooter = (props: WizardFooterProps) => {
    const next = props.actions.find((action) => action.isNext)
    return (
        <>
            {next === undefined ? null : (
                <Button intent="commit" {...flagsOf(next)} onPress={next.onPress}>
                    {next.label}
                </Button>
            )}
            {props.actions
                .filter((action) => !action.isNext)
                .map((action) => (
                    <Button key={action.id} intent={action.intent} {...flagsOf(action)} onPress={action.onPress}>
                        {action.label}
                    </Button>
                ))}
        </>
    )
}

/** The commit button of a step: the way forward. */
export const nextAction = (
    label: string,
    onPress: () => void,
    flags: { readonly isPending?: boolean; readonly isDisabled?: boolean } = {},
): WizardAction => ({
    id: "next",
    label,
    intent: "alternative",
    isNext: true,
    onPress,
    ...flags,
})

/** The dismiss button that leaves the wizard from its first step. */
export const closeAction = (label: string, onPress: () => void, isDisabled = false): WizardAction => ({
    id: "close",
    label,
    intent: "dismiss",
    isDisabled,
    onPress,
})

/** The way back of a wizard step: a dismiss button that waits while the step works. */
export const backAction = (label: string, isDisabled: boolean, onPress: () => void): WizardAction => ({
    id: "back",
    label,
    intent: "dismiss",
    isDisabled,
    onPress,
})

/** The first step of a wizard: go on, or leave. */
export const startActions = (
    nextLabel: string,
    closeLabel: string,
    onNext: () => void,
    onClose: () => void,
): ReadonlyArray<WizardAction> => [nextAction(nextLabel, onNext), closeAction(closeLabel, onClose)]
