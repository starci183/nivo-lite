import { Alert, RadioGroup, Text } from "@starci/grammar/common"
import type { MoneyEnvironmentView, MoneyWizardCopy } from "@/modules/types"

/** The resolved environment choice and its provider availability. */
interface MoneyEnvironmentStepProps extends MoneyEnvironmentView {
    readonly label: string
    readonly isLocked: boolean
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly text: Pick<MoneyWizardCopy, "envHint" | "createdLocked">
    readonly onChange: (value: "test" | "live") => void
}

/** Draws the same environment controls and notices. */
export const MoneyEnvironmentStep = (props: MoneyEnvironmentStepProps) => (
    <>
        {props.showEnvHint ? (
            <Text size="sm" tone="muted">
                {props.text.envHint}
            </Text>
        ) : null}
        <RadioGroup
            label={props.label}
            isLabelHidden
            isDisabled={props.isPending || props.isLoading}
            value={props.environment}
            onValueChange={(value) => props.onChange(value === "test" ? "test" : "live")}
            options={[...props.environments]}
            isLoading={props.isLoading}
        />
        {props.noTestNote === null ? null : (
            <Alert tone="informative" title={props.noTestNote} isLoading={props.isLoading} />
        )}
        {props.isLocked ? (
            <Text size="xs" tone="muted">
                {props.text.createdLocked}
            </Text>
        ) : null}
    </>
)
