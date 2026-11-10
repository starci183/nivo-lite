import type { ReactNode } from "react"
import { Cluster, EmptyNotice, Stack, Sublabel, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { SetupGateBody } from "@/components/branches/SetupGateBody"
import type { AgentSetupCopy, SetupSideGate, SetupSideView } from "@/modules/types"

/** What the card can do: edit an item, confirm or reopen it. */
interface AgentSetupUnderstandingCommands {
    readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly startEdit: (gateKey: string, evidence: string) => void
    readonly stopEdit: () => void
    readonly editText: (value: string) => void
}

/** The anatomy of the card: the read of the side, the words, and the progress with the publish control in its foot. */
interface AgentSetupUnderstandingProps {
    readonly view: SetupSideView
    readonly isLoading: boolean
    readonly copy: AgentSetupCopy
    readonly status: string
    /** The version in use, as the one chip of the graph versions says it ("Version 2 · in use"); empty before the first one. */
    readonly chip: string
    /** The publish control; null while the version in use is the running one (the chip already says it). */
    readonly publish: ReactNode
    readonly on: AgentSetupUnderstandingCommands
}

const GROUPS = ["auto", "ask", "never"] as const

/** The card props and the group a list draws. */
type GroupViewProps = AgentSetupUnderstandingProps & { readonly group: (typeof GROUPS)[number] }

/** The row of one item: its rule text, its status chip and "Edit", or the editor when it is being edited. */
const rowOf = (props: AgentSetupUnderstandingProps, gate: SetupSideGate): ListRowData => {
    const gates = props.view.gates
    const isEditing = gates.editing === gate.key
    const hasEvidence = gate.evidence !== ""
    return {
        id: gate.key,
        title: hasEvidence ? gate.evidence : gate.label,
        description: hasEvidence ? gate.label : gate.hint,
        badges: [{ label: gate.statusLabel, tone: gate.statusTone, isDot: true }],
        ...(isEditing
            ? {
                  detail: (
                      <SetupGateBody
                          {...gates}
                          isLoading={props.isLoading}
                          gate={gate}
                          isEditing
                          onEditText={props.on.editText}
                          onGate={props.on.gate}
                          onStopEdit={props.on.stopEdit}
                      />
                  ),
              }
            : {
                  action: {
                      label: gates.editLabel,
                      isPending: gates.isGating,
                      press: () => props.on.startEdit(gate.key, gate.evidence),
                  },
              }),
        actionPlacement: "end",
    }
}

/** One group inside the labelled section: its Sublabel (12, weight 500, muted) above one list card of rows. */
const GroupView = (props: GroupViewProps) => {
    const label = props.copy.groupLabels[props.group]
    const gates = props.view.gates.gates.filter((gate) => gate.group === props.group)
    if (gates.length === 0) return null
    return (
        <Stack gap="inline">
            <Sublabel>{label}</Sublabel>
            <SurfaceCard
                kind="list"
                ariaLabel={label}
                isLoading={props.isLoading}
                items={gates.map((gate) => rowOf(props, gate))}
                empty={<EmptyNotice message={props.copy.understandingEmpty} />}
            />
        </Stack>
    )
}

/** The caption under the last group: where the draft stands in words, and the publish control only while there is one to press. */
const CaptionView = (props: AgentSetupUnderstandingProps) => (
    <Cluster gap="inline" justify="between">
        <Text size="xs" tone="muted">
            {[props.view.gates.progressLabel, props.status].filter((part) => part !== "").join(" · ")}
        </Text>
        {props.publish}
    </Cluster>
)

/**
 * "What the agent understands about your work": the section Label (the version in use as plain text at its end), then the items of the setup
 * in three groups (what it does on its own, what it must ask, what it never does), each a Sublabel above its own card of rows
 * (rule text, status chip, "Edit"), and one caption line under the last group. No card wraps the groups.
 */
export const AgentSetupUnderstanding = (props: AgentSetupUnderstandingProps) => {
    const { chip } = props
    return (
        <Stack gap="row">
            <Cluster gap="inline" justify="between">
                <Text size="sm" isStrong>
                    {props.copy.understandingTitle}
                </Text>
                <Text size="xs" tone="muted">
                    {chip === "" ? props.copy.versionNone : chip}
                </Text>
            </Cluster>
            <Stack gap="inline">
                {GROUPS.map((group) => (
                    <GroupView key={group} {...props} group={group} />
                ))}
            </Stack>
            <CaptionView {...props} />
        </Stack>
    )
}
