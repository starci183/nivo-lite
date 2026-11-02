import { Alert, Section, Stack, Text } from "@starci/grammar/common"
import type { VerifyHelpView } from "@/modules/types"

/** What the first-event wait draws. */
type WizardVerifyStepProps = {
    readonly isLoading?: boolean

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
            <Stack gap="inline">
                {props.help.steps.length === 0 ? (
                    <Text size="sm">{props.help.intro}</Text>
                ) : (
                    <Section
                        kind="list"
                        title={props.help.intro}
                        headingLevel={4}
                        empty={<Text>{props.waiting}</Text>}
                        items={props.help.steps.map((step, index) => ({
                            id: String(index),
                            title: step,
                            leading: { position: index + 1 },
                        }))}
                    />
                )}
            </Stack>
        )}
        {props.received === null ? (
            <Text size="sm" isStrong live="polite">
                {props.waiting}
            </Text>
        ) : (
            <Alert
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                tone="affirmative"
                title={props.received}
            />
        )}
        {props.failed !== null && props.received === null ? (
            <Text size="xs" tone="muted">
                {props.failed}
            </Text>
        ) : null}
    </>
)
