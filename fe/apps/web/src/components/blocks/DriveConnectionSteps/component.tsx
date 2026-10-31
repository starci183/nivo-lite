import { Button, EmptyNotice, PaneSection } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionSteps } from "@/components/composites/ConnectionSteps"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and whether it is open. */
interface DriveSetupStepView {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
}

/** The notice and command that stand in place of the steps while there is no grant at all. */
interface DriveUngrantedView {
    readonly message: string
    readonly description: string
    readonly action: string
}

/** Props for {@link DriveConnectionStepsBase}. */
export interface DriveConnectionStepsBaseProps {
    /** The body of the choose step, connected by the page; the other two steps are guidance and a command. */
    readonly shape: Readonly<Record<string, ReactNode>>
    readonly props: {
        readonly steps: ReadonlyArray<DriveSetupStepView>
        /** Set while there is no grant: the page says what to do in place of the steps. */
        readonly ungranted?: DriveUngrantedView
        readonly isGranting: boolean
        /** Sends the owner or manager to Google to grant (again) the read access; absent while the grant stands. */
        readonly regrant?: { readonly label: string }
        readonly brain: { readonly label: string; readonly href: string }
    }
    readonly on: {
        readonly toggle: (id: string, isOpen: boolean) => void
        readonly grant: () => void
    }
}

/** The command a step carries after its body: the grant again on the first, the way into Second Brain on the last. */
const actionOf = (id: string, view: DriveConnectionStepsBaseProps["props"], grant: () => void): ReactNode => {
    if (id === "brain") {
        return (
            <Button intent="neutral" href={view.brain.href}>
                {view.brain.label}
            </Button>
        )
    }
    if (id !== "grant" || view.regrant === undefined) return undefined
    return (
        <Button intent="alternative" isPending={view.isGranting} onPress={grant}>
            {view.regrant.label}
        </Button>
    )
}

/**
 * Draws the setup of the Google Drive grant as three numbered steps (grant the read access, choose documents, find them in Second
 * Brain), each a band of the main pane whose head says whether the step is done. With no grant at all, one notice and its command
 * stand in place of the steps.
 */
export const DriveConnectionStepsBase = (props: DriveConnectionStepsBaseProps) => {
    const { ungranted } = props.props
    if (ungranted !== undefined) {
        return (
            <PaneSection>
                <EmptyNotice
                    message={ungranted.message}
                    description={ungranted.description}
                    actionLabel={ungranted.action}
                    isActionPending={props.props.isGranting}
                    onAction={props.on.grant}
                />
            </PaneSection>
        )
    }
    return (
        <ConnectionSteps
            steps={props.props.steps.map((step) => ({
                ...step,
                body: props.shape[step.id] ?? null,
                actions: actionOf(step.id, props.props, props.on.grant),
            }))}
            onToggle={props.on.toggle}
        />
    )
}
