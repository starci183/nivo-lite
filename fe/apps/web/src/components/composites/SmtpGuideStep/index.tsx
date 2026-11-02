import { Alert, Link, Section, Text } from "@starci/grammar/common"
import type { SmtpGuideView } from "@/modules/types"

/** What the guide step draws. */
type SmtpGuideStepProps = {
    readonly isLoading?: boolean

    readonly guide: SmtpGuideView
    readonly stepsTitle: string
    readonly cautionTitle: string
}

/** The guide of the chosen way of sending: where it connects, the steps for a non-technical owner and what to watch for. */
export const SmtpGuideStep = (props: SmtpGuideStepProps) => (
    <>
        <Text size="sm" isStrong>
            {props.guide.modeLabel}
        </Text>
        <Text size="sm" tone="muted">
            {props.guide.when}
        </Text>
        {props.guide.prefilled === null ? null : (
            <Alert
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                tone="informative"
                title={props.guide.prefilled}
            />
        )}
        <Section
            kind="list"
            title={props.stepsTitle}
            headingLevel={3}
            items={props.guide.steps.map((step, position) => ({
                id: String(position),
                title: step.text,
                leading: { position: position + 1 },
                detail:
                    step.link === null ? undefined : (
                        <Link kind="external" href={step.link.url}>
                            {step.link.label}
                        </Link>
                    ),
            }))}
            empty={
                <Text size="sm" tone="muted">
                    {props.stepsTitle}
                </Text>
            }
        />
        {props.guide.caution === null ? null : (
            <Alert tone="cautionary" title={props.cautionTitle} description={props.guide.caution} />
        )}
    </>
)
