import { Button } from "@starci/grammar/common"

/** One button of a wizard step: the way forward is primary, the way out is outline or ghost. */
export type WizardAction = {
    readonly id: string
    readonly label: string
    readonly variant: "primary" | "secondary" | "outline" | "ghost"
    readonly onPress: () => void
    readonly isPending?: boolean
    readonly isDisabled?: boolean
}

/** What the footer of a wizard step draws. */
type WizardFooterProps = {
    readonly actions: ReadonlyArray<WizardAction>
}

/** The buttons of a wizard step, in the order given: one filled primary first, the way out last. */
export const WizardFooter = (props: WizardFooterProps) => (
    <>
        {props.actions.map((action) => (
            <Button
                key={action.id}
                variant={action.variant}
                isPending={action.isPending}
                isDisabled={action.isDisabled}
                onPress={action.onPress}
            >
                {action.label}
            </Button>
        ))}
    </>
)

/** The filled primary button of a step: the way forward. */
export const nextAction = (
    label: string,
    onPress: () => void,
    flags: { readonly isPending?: boolean; readonly isDisabled?: boolean } = {},
): WizardAction => ({
    id: "next",
    label,
    variant: "primary",
    onPress,
    ...flags,
})

/** The ghost button that leaves the wizard from its first step. */
export const closeAction = (label: string, onPress: () => void, isDisabled = false): WizardAction => ({
    id: "close",
    label,
    variant: "ghost",
    isDisabled,
    onPress,
})

/** The way back of a wizard step: an outline button that waits while the step works. */
export const backAction = (label: string, isDisabled: boolean, onPress: () => void): WizardAction => ({
    id: "back",
    label,
    variant: "outline",
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
