import type { ReactElement } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import type { DataSlot, SandboxAgentChoice, SandboxCopy } from "@/modules/types"

/** What the agent choice list draws and does. */
interface SandboxAgentChoicesProps {
    readonly copy: SandboxCopy
    /** The card's sublabel. */
    readonly label: string
    readonly slot: DataSlot<ReadonlyArray<SandboxAgentChoice>>
    readonly value: ReadonlyArray<string>
    readonly isPending: boolean
    /** What stands in place of the list when no agent can be chosen; nothing is drawn when it is absent. */
    readonly empty?: ReactElement
    readonly onChange: (agentIds: ReadonlyArray<string>) => void
    readonly onRetry: () => void
}

/** The agents while they are read, and when none can be chosen: no row. */
const NO_AGENTS: ReadonlyArray<SandboxAgentChoice> = []

/** The agents of the workspace as the app's one choice list (a select card, checkbox rows): the chosen ones go back to the caller. */
export const SandboxAgentChoices = (props: SandboxAgentChoicesProps): ReactElement | null => {
    const isLoading = "isLoading" in props.slot
    const isFailed = "isError" in props.slot || "isForbidden" in props.slot
    const choices = "items" in props.slot ? props.slot.items : NO_AGENTS
    const failure = {
        error: { message: props.copy.agents.errorTitle, actionLabel: props.copy.retryLabel, onAction: props.onRetry },
    }
    const failureProp = isFailed ? failure : {}
    const isNone = !isLoading && !isFailed && choices.length === 0
    return isNone ? (props.empty ?? null) : (
        <SurfaceCard
            kind="select"
            sublabel={props.label}
            selectionMode="multiple"
            value={props.value}
            onChange={(ids) => props.onChange([...ids])}
            isLoading={isLoading}
            {...failureProp}
            items={choices.map((choice) => ({ id: choice.id, title: choice.label, isDisabled: props.isPending }))}
        />
    )
}
