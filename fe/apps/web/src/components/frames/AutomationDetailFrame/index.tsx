import type { ReactNode } from "react"
import { Alert, Button, Section, Text, Stack, Cluster } from "@starci/grammar/common"
import { DETAIL_CLASS } from "./classNames"
/** The run-now action of a scheduled workflow. */
type AutomationRunNow = {
    readonly label: string
    readonly isPending: boolean
    readonly startedText?: string
    readonly onPress: () => void
}

/** What the frame of the detail panel shows, already in the reader language. */
type AutomationDetailFrameProps = {
    readonly name: string
    readonly description: string
    readonly closeLabel: string
    readonly awaitingText?: string
    readonly errorText?: string
    readonly runNow?: AutomationRunNow
    readonly dismissLabel: string
    readonly isBusy: boolean
    /** The detail sits inside another bounded surface (the module settings card). */
    readonly onClose: () => void
    readonly onDismiss: () => void
    /** The sections: settings, message, gate, runs. */
    readonly children: ReactNode
}

/** Everything about one automation in one surface: its name, the alerts, the sections, the run-now action and "not for me". */
export const AutomationDetailFrame = (props: AutomationDetailFrameProps) => (
    <aside className={DETAIL_CLASS} aria-label={props.name} id="automation-detail">
        <Section
            title={props.name}
            description={props.description}
            action={
                <Button intent="neutral" size="sm" onPress={props.onClose}>
                    {props.closeLabel}
                </Button>
            }
        >
            <Stack gap="section">
                {props.awaitingText === undefined ? null : <Alert title={props.awaitingText} tone="informative" />}
                {props.errorText === undefined ? null : <Alert title={props.errorText} tone="negative" />}
                {props.children}
                {props.runNow === undefined ? null : (
                    <Cluster gap="inline">
                        <Button intent="neutral" isPending={props.runNow.isPending} onPress={props.runNow.onPress}>
                            {props.runNow.label}
                        </Button>
                        {props.runNow.startedText === undefined ? null : (
                            <Text size="sm" live="polite">
                                {props.runNow.startedText}
                            </Text>
                        )}
                    </Cluster>
                )}
                <Cluster gap="inline">
                    <Button intent="neutral" size="sm" isDisabled={props.isBusy} onPress={props.onDismiss}>
                        {props.dismissLabel}
                    </Button>
                </Cluster>
            </Stack>
        </Section>
    </aside>
)
