import type { ReactNode } from "react"
import { Alert, Badge, Button, Cluster, Code, DescriptionList, Link, Stack, Text } from "@starci/grammar/common"
import type { RunStepRow } from "../../rows/run-timeline"

/** The words a step draws that are not its own data. */
export interface RunStepWords {
    /** The words of the state of the step. */
    readonly state: string
    /** The term of what the step was given. */
    readonly input: string
    /** The term of what the step produced. */
    readonly output: string
    /** The term of the effect key. */
    readonly effectKey: string
    /** The words of a call that succeeded. */
    readonly callOk: string
    /** The words of a call that failed. */
    readonly callFailed: string
    /** The words of the link to the approval a waiting step waits for. */
    readonly approval: string
}

/** The command that runs a parked run again. */
export interface RunStepResume {
    /** The words on the button. */
    readonly label: string
    /** Whether the run is being resumed now. */
    readonly isPending: boolean
    /** Runs the parked run again. */
    readonly onPress: () => void
}

/** One step of a run and what it needs from its block. */
interface RunStepBodyProps {
    readonly row: RunStepRow
    readonly words: RunStepWords
    /** The address of the approval a waiting step waits for; null draws no link. */
    readonly approvalHref: string | null
    /** The command to run again, offered on the one parked step that carries it; null draws none. */
    readonly resume: RunStepResume | null
    readonly isLoading: boolean
}

/** The facts of a step: what it was given and produced, and the key its outside effect was recorded under. */
const StepFacts = (props: Pick<RunStepBodyProps, "row" | "words" | "isLoading">): ReactNode => {
    const { row, words } = props
    const items = [
        ...(row.input === "" ? [] : [{ id: "input", term: words.input, description: row.input }]),
        ...(row.output === "" ? [] : [{ id: "output", term: words.output, description: row.output }]),
        ...(row.effectKey === ""
            ? []
            : [{ id: "effect", term: words.effectKey, description: <Code>{row.effectKey}</Code> }]),
    ]
    return items.length === 0 ? null : (
        <DescriptionList
            layout="columns"
            density="compact"
            isDivided={false}
            isLoading={props.isLoading}
            items={items}
        />
    )
}

/** The door calls of a step, one line each, with how each ended. */
const StepCalls = (props: Pick<RunStepBodyProps, "row" | "words" | "isLoading">): ReactNode =>
    props.row.calls.length === 0 ? null : (
        <Stack gap="identity">
            {props.row.calls.map((call) => (
                <Cluster key={call.id} gap="inline">
                    <Badge tone={call.ok ? "success" : "danger"} isLoading={props.isLoading}>
                        {call.ok ? props.words.callOk : props.words.callFailed}
                    </Badge>
                    <Text size="sm" mono isLoading={props.isLoading}>
                        {call.tool}
                    </Text>
                    {call.summary === "" ? null : (
                        <Text size="sm" tone="muted" isLoading={props.isLoading}>
                            {call.summary}
                        </Text>
                    )}
                </Cluster>
            ))}
        </Stack>
    )

/** Under a step: why it stopped, the one command to run a parked step again, or the link to the approval it waits for. */
const StepNeeds = (props: RunStepBodyProps): ReactNode => {
    const { row } = props
    const hasReason = row.reason !== "" || row.state === "parked"
    return (
        <>
            {hasReason ? (
                <Alert
                    tone={row.state === "failed" ? "negative" : "cautionary"}
                    title={row.reason === "" ? props.words.state : row.reason}
                    isLoading={props.isLoading}
                />
            ) : null}
            {props.resume === null || !row.canResume ? null : (
                <Cluster gap="inline">
                    <Button intent="commit" size="sm" isPending={props.resume.isPending} onPress={props.resume.onPress}>
                        {props.resume.label}
                    </Button>
                </Cluster>
            )}
            {props.approvalHref === null ? null : (
                <Link href={props.approvalHref} isDisabled={props.isLoading}>
                    {props.words.approval}
                </Link>
            )}
        </>
    )
}

/** The body of one entry of the run timeline: state and time taken, facts, calls, and what the step needs from a person. */
export const RunStepBody = (props: RunStepBodyProps): ReactNode => (
    <Stack gap="row">
        <Cluster gap="inline">
            <Badge tone={props.row.tone} isLoading={props.isLoading}>
                {props.words.state}
            </Badge>
            {props.row.duration === "" ? null : (
                <Text size="xs" tone="muted" tabular isLoading={props.isLoading}>
                    {props.row.duration}
                </Text>
            )}
        </Cluster>
        <StepFacts row={props.row} words={props.words} isLoading={props.isLoading} />
        <StepCalls row={props.row} words={props.words} isLoading={props.isLoading} />
        <StepNeeds {...props} />
    </Stack>
)
