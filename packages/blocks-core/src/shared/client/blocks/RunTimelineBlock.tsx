import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Timeline } from "@starci/grammar/common"
import type { runTimelineBlock } from "../../blocks/run-timeline.block"
import { cellContextOf } from "../../rows/cell-format"
import { runStateLook, type RunState } from "../../rows/run-state"
import { RUN_PLACEHOLDER, runStepsOf, runWithSteps } from "../../rows/run-timeline"
import { runView } from "../../rows/run-timeline-view"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { RunStepBody, type RunStepWords } from "../composites/RunStepBody"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The steps of one run, in order, with their calls and effect keys; a parked step offers to run again, a waiting one links to its approval. */
export const RunTimelineBlock = (props: RenderOf<typeof runTimelineBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "runTimelineIdle" })
    const read = props.slots.run
    const resume = props.slots.resume
    const context = cellContextOf(host.locale(), undefined)
    const run = derivedSlot(parsedSlot(read.slot, runView), runWithSteps)
    const wordsOf = (state: RunState): RunStepWords => ({
        state: words({ key: runStateLook(state).key }),
        input: words({ key: "runStepInput" }),
        output: words({ key: "runStepOutput" }),
        effectKey: words({ key: "runStepEffectKey" }),
        callOk: words({ key: "runCallOk" }),
        callFailed: words({ key: "runCallFailed" }),
        approval: words({ key: "runStepApproval" }),
    })
    const resumeRun = (id: string): void => {
        resume
            .run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    return (
        <SlotView
            slot={run}
            labels={labels}
            placeholder={RUN_PLACEHOLDER}
            onRetry={read.retry}
            render={(view, isLoading) => (
                <Timeline
                    label={words(props.props.label)}
                    isLoading={isLoading}
                    items={runStepsOf(view, context).map((row) => ({
                        id: row.id,
                        title: row.title,
                        state: row.presentation,
                        isAttention: row.isAttention,
                        isCurrent: row.isCurrent,
                        ...(row.dateTime === null ? {} : { dateTime: row.dateTime, timeLabel: row.timeLabel }),
                        description: (
                            <RunStepBody
                                row={row}
                                words={wordsOf(row.state)}
                                approvalHref={row.approvalPath === null ? null : host.navigation.href(row.approvalPath)}
                                isLoading={isLoading}
                                resume={
                                    resume.isAllowed
                                        ? {
                                              label: resume.label,
                                              isPending: resume.isRunning,
                                              onPress: () => resumeRun(view.id),
                                          }
                                        : null
                                }
                            />
                        ),
                    }))}
                />
            )}
        />
    )
}
