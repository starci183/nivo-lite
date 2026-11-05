import { CopyField } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { CONNECTION_LINES_PLACEHOLDER, ConnectionLines } from "@/components/composites/ConnectionLines"
import { ConnectionSteps } from "@/components/composites/ConnectionSteps"
import { ConnectionGrantsBand } from "@/components/frames/ConnectionGrantsBand"
import type { ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ConnectionLineView, DataSlot, SlotLabels } from "@/modules/types"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and whether it is open. */
interface TelegramSetupStepView {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
    readonly isDone: boolean
}

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const WEBHOOK_PLACEHOLDER = "https://example.invalid/api/telegram/00000000"

/** Props for {@link TelegramConnectionStepsBase}. */
export interface TelegramConnectionStepsBaseProps {
    readonly props: {
        readonly steps: ReadonlyArray<TelegramSetupStepView>
        readonly stepsLabel: string
        /** The webhook step: the address NIVO registered with Telegram, to read and copy. */
        readonly webhook: {
            readonly label: string
            readonly description: string
            readonly url: DataSlot<string>
            readonly slotLabels: SlotLabels
            readonly copyLabel: string
            readonly copiedLabel: string
            readonly copyErrorLabel: string
        }
        /** The check step: each part of the connection with its verdict. */
        readonly checks: {
            readonly title: string
            readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
            readonly slotLabels: SlotLabels
        }
        /** The agents step: every agent that works through the bot, with its level. */
        readonly grants: ConnectionGrantsBandProps["props"]
    }
    readonly on: {
        readonly toggle: (id: string, isOpen: boolean) => void
        readonly retryWebhook: () => void
        readonly retryChecks: () => void
        readonly pickGrant: (agentId: string, level: string) => void
        readonly assignGrant: (agentId: string) => void
        readonly retryGrants: () => void
    }
}

type StepBodyProps = Pick<TelegramConnectionStepsBaseProps, "props" | "on">

/** Draws the body of the webhook step: the address NIVO registered with Telegram, to read and copy (nothing is pasted anywhere). */
const WebhookBody = (props: StepBodyProps) => (
    <SlotView
        slot={props.props.webhook.url}
        placeholder={WEBHOOK_PLACEHOLDER}
        labels={props.props.webhook.slotLabels}
        onRetry={props.on.retryWebhook}
        render={(url, isLoading) => (
            <CopyField
                label={props.props.webhook.label}
                description={props.props.webhook.description}
                value={url}
                copyLabel={props.props.webhook.copyLabel}
                copiedLabel={props.props.webhook.copiedLabel}
                copyErrorLabel={props.props.webhook.copyErrorLabel}
                isLoading={isLoading}
            />
        )}
    />
)

/** Draws the check list of the third step: each part of the connection with its verdict and the line that says how to fix it. */
const ChecksBody = (props: StepBodyProps) => (
    <SlotView
        slot={props.props.checks.lines}
        placeholder={CONNECTION_LINES_PLACEHOLDER}
        labels={props.props.checks.slotLabels}
        onRetry={props.on.retryChecks}
        render={(lines, isSkeleton) => (
            <ConnectionLines label={props.props.checks.title} isSkeleton={isSkeleton} lines={lines} />
        )}
    />
)

/** Draws the body of the last step: every agent that works through a Telegram bot with its level, and the control that gives it to another. */
const AgentsBody = (props: StepBodyProps) => (
    <ConnectionGrantsBand
        props={props.props.grants}
        on={{ pick: props.on.pickGrant, assign: props.on.assignGrant, retry: props.on.retryGrants }}
    />
)

/** The body of one step; the first step is guidance alone. */
const bodyOf = (id: string, props: StepBodyProps): ReactNode => {
    switch (id) {
        case "webhook":
            return <WebhookBody props={props.props} on={props.on} />
        case "check":
            return <ChecksBody props={props.props} on={props.on} />
        case "agents":
            return <AgentsBody props={props.props} on={props.on} />
        default:
            return null
    }
}

/**
 * Draws the setup of a Telegram bot connection as numbered steps in the order the back end does them, each a band of the main pane
 * whose head says whether the step is done. A done step stays closed until the reader opens it.
 */
export const TelegramConnectionStepsBase = (props: TelegramConnectionStepsBaseProps) => (
    <ConnectionSteps
        label={props.props.stepsLabel}
        steps={props.props.steps.map((step) => ({ ...step, body: bodyOf(step.id, props) }))}
        onToggle={props.on.toggle}
    />
)
