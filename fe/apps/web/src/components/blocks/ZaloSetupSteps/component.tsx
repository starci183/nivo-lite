import { Alert, Button } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionSteps } from "@/components/composites/ConnectionSteps"
import type { ZaloStepId } from "@/modules/types"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and whether it is open. */
export interface ZaloSetupStepView {
    readonly id: ZaloStepId
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
}

/** The commands a step carries under its fields. */
export interface ZaloSetupStepCommands {
    /** Opens the Zalo developer site in a new tab, where the app is set up. */
    readonly openZalo: { readonly label: string; readonly href: string }
    /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
    readonly authorize?: {
        readonly label: string
        readonly isPending: boolean
        /** The OA is not authorized yet: granting it is the page's next step, its one commit (CTA-1). */
        readonly isNext: boolean
    }
}

/** Props for {@link ZaloSetupStepsBase}. */
export interface ZaloSetupStepsBaseProps {
    /** The body of each step, connected by the page: what step 3 shows is its guidance and its command alone. */
    readonly shape: Readonly<Record<Exclude<ZaloStepId, "authorize">, ReactNode>>
    readonly props: {
        readonly steps: ReadonlyArray<ZaloSetupStepView>
        readonly commands: ZaloSetupStepCommands
        /** Why the last authorization did not start, worded by the back end; empty when there is none. */
        readonly authorizeNotice: string
    }
    readonly on: {
        readonly toggle: (id: ZaloStepId, isOpen: boolean) => void
        readonly authorize: () => void
    }
}

type ZaloSetupStepsBandProps = Pick<ZaloSetupStepsBaseProps, "props" | "on">

const actionsOf = (props: ZaloSetupStepsBandProps, id: ZaloStepId): ReactNode => {
    const { commands } = props.props
    if (id === "paste") {
        return (
            <Button intent="neutral" href={commands.openZalo.href} target="_blank" rel="noreferrer">
                {commands.openZalo.label}
            </Button>
        )
    }
    if (id !== "authorize" || commands.authorize === undefined) return undefined
    return (
        <Button
            intent={commands.authorize.isNext ? "commit" : "neutral"}
            isPending={commands.authorize.isPending}
            onPress={props.on.authorize}
        >
            {commands.authorize.label}
        </Button>
    )
}

const authorizeBodyOf = (notice: string): ReactNode =>
    notice === "" ? null : <Alert tone="negative" appearance="soft" title={notice} />

/**
 * Draws the setup of a Zalo OA connection as numbered steps in the order the back end needs them, each a band of the main pane whose
 * head says whether the step is done. A done step stays closed until the owner opens it.
 */
export const ZaloSetupStepsBase = (props: ZaloSetupStepsBaseProps) => (
    <ConnectionSteps
        steps={props.props.steps.map((step) => ({
            ...step,
            body: step.id === "authorize" ? authorizeBodyOf(props.props.authorizeNotice) : props.shape[step.id],
            actions: actionsOf({ props: props.props, on: props.on }, step.id),
        }))}
        onToggle={(id, isOpen) => {
            const step = props.props.steps.find((candidate) => candidate.id === id)
            if (step !== undefined) props.on.toggle(step.id, isOpen)
        }}
    />
)
