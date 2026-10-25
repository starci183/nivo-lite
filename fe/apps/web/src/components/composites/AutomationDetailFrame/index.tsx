import type { ReactNode } from "react"
import { Alert, Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { ACTIONS_CLASS, DETAIL_CLASS, DETAIL_STACK_CLASS, FACTS_CLASS, HEAD_ROW_CLASS } from "./classNames"

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
        <SurfaceCard>
            <div className={DETAIL_STACK_CLASS}>
                <div className={HEAD_ROW_CLASS}>
                    <div className={FACTS_CLASS}>
                        <Heading level={2}>{props.name}</Heading>
                        <Text size="sm" tone="muted">
                            {props.description}
                        </Text>
                    </div>
                    <Button intent="neutral" size="sm" onPress={props.onClose}>
                        {props.closeLabel}
                    </Button>
                </div>
                {props.awaitingText === undefined ? null : <Alert title={props.awaitingText} tone="informative" />}
                {props.errorText === undefined ? null : <Alert title={props.errorText} tone="negative" />}
                {props.children}
                {props.runNow === undefined ? null : (
                    <div className={ACTIONS_CLASS}>
                        <Button intent="neutral" isPending={props.runNow.isPending} onPress={props.runNow.onPress}>
                            {props.runNow.label}
                        </Button>
                        {props.runNow.startedText === undefined ? null : (
                            <Text size="sm" live="polite">
                                {props.runNow.startedText}
                            </Text>
                        )}
                    </div>
                )}
                <div className={ACTIONS_CLASS}>
                    <Button intent="neutral" size="sm" isDisabled={props.isBusy} onPress={props.onDismiss}>
                        {props.dismissLabel}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    </aside>
)
