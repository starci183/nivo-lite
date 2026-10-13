import { Alert, Button, LeadingNumber, List, ListItem, Text } from "@starci/grammar/common"
import type { SmtpGuideView } from "@/modules/types"
import { smtpGuideStepClassNames as classNames } from "./classNames"

/** What the guide step draws. */
type SmtpGuideStepProps = {
    readonly guide: SmtpGuideView
    readonly stepsTitle: string
    readonly cautionTitle: string
}

/** The guide of the chosen way of sending: where it connects, the steps for a non-technical owner and what to watch for. */
export const SmtpGuideStep = (props: SmtpGuideStepProps) => (
    <>
        <Text size="sm" weight="semibold">
            {props.guide.modeLabel}
        </Text>
        <Text size="sm" tone="muted">
            {props.guide.when}
        </Text>
        {props.guide.prefilled === null ? null : <Alert tone="informative" title={props.guide.prefilled} />}
        <Text size="sm" weight="semibold">
            {props.stepsTitle}
        </Text>
        <List as="ol" className={classNames.stepList}>
            {props.guide.steps.map((step, position) => (
                <ListItem key={step.text}>
                    <div className={classNames.stepItem}>
                        <Text size="sm" startContent={<LeadingNumber position={position + 1} />}>
                            {step.text}
                        </Text>
                        {step.link === null ? null : (
                            <div className={classNames.buttons}>
                                <Button variant="outline" href={step.link.url} target="_blank" rel="noreferrer">
                                    {step.link.label}
                                </Button>
                            </div>
                        )}
                    </div>
                </ListItem>
            ))}
        </List>
        {props.guide.caution === null ? null : (
            <Alert tone="cautionary" title={props.cautionTitle} description={props.guide.caution} />
        )}
    </>
)
