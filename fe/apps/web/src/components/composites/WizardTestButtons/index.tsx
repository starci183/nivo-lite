import { WizardFooter } from "@/components/branches/WizardFooter"

/** Labels and commands of the run and repair buttons of a wizard test step. */
interface WizardTestButtonsProps {
    readonly run: string
    readonly repair: string
    readonly canRepair: boolean
    readonly isDisabled: boolean
    readonly onRun: () => void
    readonly onRepair: () => void
    /** The step is a placeholder: the buttons draw but cannot be pressed. */
    readonly isLoading: boolean
}

/** The run and repair buttons of a wizard test step; repair is offered only when it can run. */
export const WizardTestButtons = (props: WizardTestButtonsProps) => (
    <WizardFooter
        actions={[
            { id: "run", label: props.run, intent: "alternative", onPress: props.onRun, isDisabled: props.isDisabled },
            ...(props.canRepair
                ? [
                      {
                          id: "repair",
                          label: props.repair,
                          intent: "alternative" as const,
                          onPress: props.onRepair,
                          isDisabled: props.isDisabled,
                      },
                  ]
                : []),
        ]}
        isLoading={props.isLoading}
    />
)
