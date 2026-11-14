import { Button } from "@starci/grammar/common"

/** One button of a wizard step: the way forward is the one next step, the way out dismisses. */
export type WizardAction = {
    readonly id: string
    readonly label: string
    readonly intent: "alternative" | "dismiss" | "neutral"
    /** The one way forward of the step: the footer draws it as the commit. */
    readonly isNext?: true
    /** The way forward leads on to the next step: its button ends in the arrow. */
    readonly isForward?: true
    readonly onPress: () => void
    readonly isPending?: boolean
    readonly isDisabled?: boolean
}

/** What the footer of a wizard step draws. */
type WizardFooterProps = {
    readonly actions: ReadonlyArray<WizardAction>
    /** The buttons are drawn but cannot be pressed while the step is a placeholder. */
    readonly isLoading?: boolean
}

/** The arrow a forward action ends in. */
const arrowOf = (action: WizardAction) => (action.isForward === true ? { endArrow: true } : {})

/** The flags a wizard action may carry onto its button. */
const flagsOf = (action: WizardAction, isLoading: boolean) => ({
    isLoading,
    ...(action.isPending === undefined ? {} : { isPending: action.isPending }),
    ...(action.isDisabled === undefined && !isLoading ? {} : { isDisabled: isLoading || action.isDisabled === true }),
})

/** The buttons of a wizard step: the commit first when the step has a way forward, then the others in the order given. */
export const WizardFooter = (props: WizardFooterProps) => {
    const next = props.actions.find((action) => action.isNext)
    const isLoading = props.isLoading === true
    return (
        <>
            {next === undefined ? null : (
                <Button
                    intent="commit"
                    {...arrowOf(next)}
                    {...flagsOf(next, isLoading)}
                    onPress={next.onPress}
                >
                    {next.label}
                </Button>
            )}
            {props.actions
                .filter((action) => !action.isNext)
                .map((action) => (
                    <Button
                        key={action.id}
                        intent={action.intent}
                        {...flagsOf(action, isLoading)}
                        onPress={action.onPress}
                    >
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

/** The commit button of a step that leads on to the next step: the way forward, with the arrow of where it goes. */
export const forwardAction = (
    label: string,
    onPress: () => void,
    flags: { readonly isPending?: boolean; readonly isDisabled?: boolean } = {},
): WizardAction => ({ ...nextAction(label, onPress, flags), isForward: true })

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
): ReadonlyArray<WizardAction> => [forwardAction(nextLabel, onNext), closeAction(closeLabel, onClose)]
