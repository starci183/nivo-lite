import { Alert, Badge, Button, LeadingNumber, List, ListRow } from "@starci/grammar/common"
import { SetupGateBody } from "@/components/branches/SetupGateBody"
import type { SetupSideGate, SetupSideView } from "@/modules/types"

/** The words of the checklist that are not part of the view. */
interface AgentSetupChecklistCopy {
    /** "NIVO is asking in the chat", under the current item. */
    readonly askingLabel: string
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
    readonly isSkeleton: boolean
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

/** The line under the title: the confirmed or proposed value, else the notice on the current item, else none. */
const descriptionOf = (gate: SetupSideGate, isCurrent: boolean, askingLabel: string): string | undefined => {
    if (gate.evidence !== "") return gate.evidence
    return isCurrent ? askingLabel : undefined
}

/** One item of the checklist: its number, title and state, the value with "Edit", and the editor while it is edited. */
const GateRow = (props: GateRowProps) => {
    const { gate } = props
    const gates = props.view.gates
    const isEditing = gates.editing === gate.key
    const description = descriptionOf(gate, props.isCurrent, props.copy.askingLabel)
    return (
        <ListRow
            isSkeleton={props.isSkeleton}
            state={rowStateOf(gate, props.isCurrent)}
            leading={<LeadingNumber position={props.position} />}
            title={gate.label}
            {...(description === undefined ? {} : { description })}
            badges={
                <Badge isDot tone={gate.statusTone}>
                    {gate.statusLabel}
                </Badge>
            }
            actions={
                isEditing ? undefined : (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={gates.isGating}
                        onPress={() => props.on.startEdit(gate.key, gate.evidence)}
                    >
                        {gates.editLabel}
                    </Button>
                )
            }
        >
            {isEditing ? (
                <SetupGateBody
                    {...gates}
                    isSkeleton={props.isSkeleton}
                    gate={gate}
                    isEditing
                    onEditText={props.on.editText}
                    onGate={props.on.gate}
                    onStopEdit={props.on.stopEdit}
                />
            ) : null}
        </ListRow>
    )
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
            <List label={props.view.gates.title}>
                {props.view.gates.gates.map((gate, index) => (
                    <GateRow
                        key={gate.key}
                        {...props}
                        gate={gate}
                        position={index + 1}
                        isCurrent={gate.key === current}
                    />
                ))}
            </List>
        </>
    )
}
