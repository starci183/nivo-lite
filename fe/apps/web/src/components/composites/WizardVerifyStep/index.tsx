import { Alert, LeadingNumber, List, ListItem, Text } from "@starci/grammar/common"
import type { VerifyHelpView } from "@/modules/types"
import { wizardVerifyStepClassNames as classNames } from "./classNames"

/** What the first-event wait draws. */
type WizardVerifyStepProps = {
    /** What the owner does meanwhile; undefined when the provider has no help. */
    readonly help: VerifyHelpView | undefined
    /** The sentence for the event that arrived; null while it has not. */
    readonly received: string | null
    readonly waiting: string
    /** The sentence for a failed check, shown only while no event has arrived. */
    readonly failed: string | null
}

/** Waits for the first event of a connection and says plainly what the owner should do meanwhile. */
export const WizardVerifyStep = (props: WizardVerifyStepProps) => (
    <>
        {props.help === undefined ? null : (
            <div className={classNames.copy}>
                <Text size="sm">{props.help.intro}</Text>
                {props.help.steps.length === 0 ? null : (
                    <List as="ol" className={classNames.numbered}>
                        {props.help.steps.map((step, index) => (
                            <ListItem key={step}>
                                <Text size="sm" startContent={<LeadingNumber position={index + 1} />}>
                                    {step}
                                </Text>
                            </ListItem>
                        ))}
                    </List>
                )}
            </div>
        )}
        {props.received === null ? (
            <Text size="sm" weight="medium" live="polite">
                {props.waiting}
            </Text>
        ) : (
            <Alert tone="affirmative" title={props.received} />
        )}
        {props.failed !== null && props.received === null ? (
            <Text size="xs" tone="muted">
                {props.failed}
            </Text>
        ) : null}
    </>
)
