import { Alert, Button, EmptyNotice, Stack, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { SetupGateBody } from "@/components/branches/SetupGateBody"
import type { SetupSideGate, SetupSideView } from "@/modules/types"

/** The words of the checklist that are not part of the view. */
interface AgentSetupChecklistCopy {
    /** "NIVO is asking in the chat", under the current item. */
    readonly askingLabel: string
    /** The shared status copy for a checklist without any gate. */
    readonly emptyLabel: string
}

/** What the checklist can do: confirm, reopen or edit an item, and follow the link of the unmet notice. */
interface AgentSetupChecklistCommands {
    readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly startEdit: (gateKey: string, evidence: string) => void
    readonly stopEdit: () => void
    readonly editText: (value: string) => void
    readonly open: (href: string) => void
}

/** View, copy and commands of the checklist. */
interface AgentSetupChecklistProps {
    readonly view: SetupSideView
    readonly isLoading: boolean
    readonly copy: AgentSetupChecklistCopy
    readonly on: AgentSetupChecklistCommands
}

/** One item of the checklist with its place in the list and whether NIVO is asking about it now. */
interface GateRowProps extends AgentSetupChecklistProps {
    readonly gate: SetupSideGate
    readonly position: number
    readonly isCurrent: boolean
}

/** The key of the first gate not confirmed yet: the item NIVO is asking about now. */
const currentGateOf = (gates: ReadonlyArray<SetupSideGate>): string =>
    gates.find((gate) => gate.status !== "confirmed")?.key ?? ""

/** The state the row is drawn in: the current item pending, a confirmed one affirmative, the rest neutral. */
const rowStateOf = (gate: SetupSideGate, isCurrent: boolean): "pending" | "affirmative" | "neutral" => {
    if (isCurrent) return "pending"
    return gate.status === "confirmed" ? "affirmative" : "neutral"
}

/** An item with a value to act on (a proposal to confirm, a confirmed one to reopen) opens its body without the Edit command. */
const hasBodyOf = (gate: SetupSideGate): boolean => gate.status !== "missing"

/**
 * The line under the title: the notice on the current item, else the value while the row has no body of its own (the body
 * shows the value with its confirm or reopen command), else none.
 */
const descriptionOf = (gate: SetupSideGate, isCurrent: boolean, askingLabel: string): string | undefined => {
    if (hasBodyOf(gate)) return isCurrent && gate.evidence === "" ? askingLabel : undefined
    if (gate.evidence !== "") return gate.evidence
    return isCurrent ? askingLabel : undefined
}

/** One item of the checklist: its number, title and state, "Edit", and the body: the editor while edited, else the value with confirm or reopen. */
const gateRowOf = (props: GateRowProps): ListRowData => {
    const { gate } = props
    const gates = props.view.gates
    const isEditing = gates.editing === gate.key
    const description = descriptionOf(gate, props.isCurrent, props.copy.askingLabel)
    return {
        id: gate.key,
        state: rowStateOf(gate, props.isCurrent),
        leading: { position: props.position },
        title: gate.label,
        ...(description === undefined ? {} : { description }),
        badges: [{ label: gate.statusLabel, tone: gate.statusTone, isDot: true }],
        detail: (
            <Stack gap="row">
                {isEditing ? null : (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={gates.isGating}
                        onPress={() => props.on.startEdit(gate.key, gate.evidence)}
                    >
                        {gates.editLabel}
                    </Button>
                )}
                {isEditing || (hasBodyOf(gate) && !props.isLoading) ? (
                    <SetupGateBody
                        {...gates}
                        isLoading={props.isLoading}
                        gate={gate}
                        isEditing={isEditing}
                        onEditText={props.on.editText}
                        onGate={props.on.gate}
                        onStopEdit={props.on.stopEdit}
                    />
                ) : null}
            </Stack>
        ),
    }
}

/** The unmet notice and the checklist items, each with its value, in the one scrolling band of the pane. */
export const AgentSetupChecklist = (props: AgentSetupChecklistProps) => {
    const current = currentGateOf(props.view.gates.gates)
    return (
        <>
            {props.view.unmet === null ? null : (
                <Alert
                    title={props.view.unmet.title}
                    description={props.view.unmet.body}
                    tone="cautionary"
                    appearance="soft"
                    action={{
                        label: props.view.unmet.actionLabel,
                        onAction: () => props.on.open(props.view.unmet?.href ?? ""),
                    }}
                />
            )}
            <SurfaceCard
                kind="list"
                ariaLabel={props.view.gates.title}
                isLoading={props.isLoading}
                empty={<EmptyNotice message={props.copy.emptyLabel} />}
                items={props.view.gates.gates.map((gate, index) =>
                    gateRowOf({ ...props, gate, position: index + 1, isCurrent: gate.key === current }),
                )}
            />
        </>
    )
}
