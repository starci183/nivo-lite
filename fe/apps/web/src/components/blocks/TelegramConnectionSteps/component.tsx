import type { ReactNode } from "react"
import { ConnectionSteps } from "@/components/composites/ConnectionSteps"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and whether it is open. */
interface TelegramSetupStepView {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
}

/** Props for {@link TelegramConnectionStepsBase}. */
export interface TelegramConnectionStepsBaseProps {
    /** The body of each step but the first, connected by the page: the first step is guidance alone. */
    readonly shape: Readonly<Record<string, ReactNode>>
    readonly props: { readonly steps: ReadonlyArray<TelegramSetupStepView> }
    readonly on: { readonly toggle: (id: string, isOpen: boolean) => void }
}

/**
 * Draws the setup of a Telegram bot connection as numbered steps in the order the back end does them, each a band of the main pane
 * whose head says whether the step is done. A done step stays closed until the reader opens it.
 */
export const TelegramConnectionStepsBase = (props: TelegramConnectionStepsBaseProps) => (
    <ConnectionSteps
        steps={props.props.steps.map((step) => ({ ...step, body: props.shape[step.id] ?? null }))}
        onToggle={props.on.toggle}
    />
)
