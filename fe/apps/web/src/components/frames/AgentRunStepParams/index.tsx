import { Button, Stack, Text, type ListRowData } from "@starci/grammar/common"
import { RunAsideGroup, RunParamValue } from "@/components/composites/RunAsideGroup"
import type { RunBranchView, RunParamView, RunStepDetailView } from "@/modules/types"

/** The words of the aside of the selected step. */
export interface AgentRunStepParamsCopy {
    readonly pick: string
    readonly started: string
    readonly ended: string
    readonly attempt: string
    readonly error: string
    readonly status: string
    readonly inputs: string
    readonly outputs: string
    readonly branches: string
    readonly noInputs: string
    readonly noOutputs: string
    readonly noBranches: string
    readonly missing: string
    readonly masked: string
    readonly taken: string
    readonly sent: string
    readonly sentAlt: (position: number) => string
    readonly log: string
    readonly decide: string
}

/** What the aside of the selected step draws. */
interface AgentRunStepParamsProps {
    readonly props: {
        readonly copy: AgentRunStepParamsCopy
        readonly step: RunStepDetailView | null
        readonly isLoading: boolean
    }
}

/** One param as a key and its value: the name, then the value it resolved to with where it came from ("= trigger.leadId") under it. */
const paramRow = (param: RunParamView, copy: AgentRunStepParamsCopy): ListRowData => ({
    id: param.id,
    title: param.name,
    value: <RunParamValue param={param} masked={copy.masked} missing={copy.missing} />,
})

/** One way out as a row: its name and where it leads; the one the run took is marked and carries the line that says so. */
const branchRow = (branch: RunBranchView, note: string, copy: AgentRunStepParamsCopy): ListRowData => ({
    id: branch.id,
    title: `${branch.label} → ${branch.target}`,
    ...(branch.isTaken
        ? {
              badges: [{ label: copy.taken, tone: "success" as const }] as const,
              ...(note === "" ? {} : { description: note }),
          }
        : {}),
})

/** How the step went as rows: where it stands, when it began and ended, the try it is on, and its error. */
const outcomeRows = (step: RunStepDetailView, copy: AgentRunStepParamsCopy): ReadonlyArray<ListRowData> => [
    {
        id: "status",
        title: copy.status,
        value: step.statusLabel,
    },
    ...(step.startedLabel === "" ? [] : [{ id: "started", title: copy.started, value: step.startedLabel }]),
    ...(step.endedLabel === "" ? [] : [{ id: "ended", title: copy.ended, value: step.endedLabel }]),
    ...(step.attemptLabel === "" ? [] : [{ id: "attempt", title: copy.attempt, value: step.attemptLabel }]),
    ...(step.error === ""
        ? []
        : [{ id: "error", title: copy.error, value: step.error, verdict: "danger" as const }]),
]

/**
 * The aside of the step a person selected, in this run: its name and kind, then one list card per group, each under its small label.
 * How it went; the params it ran with (name, where the value came from, the value it resolved to); what it made; and the ways out
 * with the one the run took marked. Secrets and personal data arrive masked.
 */
export const AgentRunStepParams = (props: AgentRunStepParamsProps) => {
    const { copy, step, isLoading } = props.props
    if (step === null)
        return (
            <Text tone="muted" isLoading={isLoading}>
                {copy.pick}
            </Text>
        )
    return (
        <Stack gap="section">
            <RunAsideGroup label={copy.status} layout="keyValue" rows={outcomeRows(step, copy)} empty="" />
            <RunAsideGroup
                label={copy.inputs}
                count={step.inputs.length}
                layout="keyValue"
                rows={step.inputs.map((param) => paramRow(param, copy))}
                empty={copy.noInputs}
            />
            <RunAsideGroup
                label={copy.outputs}
                layout="keyValue"
                rows={step.outputs.map((param) => paramRow(param, copy))}
                empty={copy.noOutputs}
            />
            <RunAsideGroup
                label={copy.branches}
                rows={step.branches.map((branch) => branchRow(branch, step.branchNote, copy))}
                empty={step.branchNote === "" ? copy.noBranches : step.branchNote}
            />
            {step.sent.length === 0 ? null : (
                <RunAsideGroup
                    label={copy.sent}
                    rows={step.sent.map((source, index) => ({
                        id: source,
                        title: copy.sentAlt(index + 1),
                        leading: { avatar: { name: copy.sentAlt(index + 1), src: source, shape: "rounded" as const } },
                    }))}
                    empty=""
                />
            )}
            {step.log.length === 0 ? null : (
                <RunAsideGroup
                    label={copy.log}
                    rows={step.log.map((line) => ({ id: line.id, title: line.text, ...(line.isFailure ? { verdict: "danger" as const } : {}) }))}
                    empty=""
                />
            )}
            {step.decideHref === "" ? null : (
                <Button intent="neutral" endArrow href={step.decideHref}>
                    {copy.decide}
                </Button>
            )}
        </Stack>
    )
}
