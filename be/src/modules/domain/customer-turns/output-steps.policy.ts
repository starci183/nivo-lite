import type { StepJson, StepSpec } from "@modules/domain/agent-runs"
import type { AuthorityOutputStep } from "@modules/domain/authority-rules"
import { gatewayArgumentsSchema } from "@modules/domain/mcp-gateway"
import { parseJsonText } from "@modules/platform/primitives"
import {
    approvedProposalSchema,
    outputStepSchema,
    type ApprovalInput,
    type ApprovedProposal,
    type HeldCall,
    type OutputCall,
    type OutputScope,
    type StoredOutput,
} from "./output-steps.schema"
import { gatewaySequenceStepsSchema } from "./turn-gateway-tools.schema"

/** The refusals of a call that named no tool: no output was reached, and the agent corrects itself. */
const NO_SUCH_TOOL: ReadonlySet<string> = new Set(["invalid_name", "unknown_tool"])
/** The kind of the step of an output node. */
export const OUTPUT_STEP_KIND = "output"
/** The kind of the step that answers the customer once an output came to something. */
export const FINAL_REPLY_STEP_KIND = "final_reply"
/** The kind of the step a held call waits on. */
export const APPROVAL_STEP_KIND = "approval"
/** The final reply of a turn; an approved item has its own, because a run can hold both. */
const FINAL_REPLY_KEY = "final_reply"
/** What every output step's key starts with, which finds them among the earlier steps. */
const OUTPUT_KEY_PREFIX = "output:"

/** The step that runs one call and carries the calls after it. A write cannot be undone, so nothing after it goes back. */
export const outputSpecOf = (call: OutputCall, rest: ReadonlyArray<OutputCall>, scope: OutputScope): StepSpec => ({
    stepKey: call.stepKey,
    nodeKey: scope.outputNode,
    kind: OUTPUT_STEP_KIND,
    effect: { kind: "pivot" },
    input: { ...call, scope, rest },
})

/** The step that holds a call for a person. It changes nothing: the world changes in the outputs that follow the answer. */
export const approvalSpecOf = (input: ApprovalInput): StepSpec => ({
    stepKey: `approval:${input.workItemId}`,
    nodeKey: input.scope.approvalNode,
    kind: APPROVAL_STEP_KIND,
    effect: { kind: "read" },
    input: { ...input },
})

const approvedCallsOf = (fields: ApprovedProposal["fields"]): ReadonlyArray<HeldCall> | null => {
    const text = fields.steps_json ?? fields.args_json
    const read = parseJsonText(text ?? "")
    if (!read.ok) return null
    if (fields.steps_json !== undefined) {
        const sequence = gatewaySequenceStepsSchema.safeParse(read.value)
        return sequence.success
            ? sequence.data.map((step) => ({ tool: step.name, argsJson: JSON.stringify(step.arguments ?? {}) }))
            : null
    }
    const args = gatewayArgumentsSchema.safeParse(read.value)
    return args.success && fields.tool !== undefined && fields.tool !== ""
        ? [{ tool: fields.tool, argsJson: JSON.stringify(args.data) }]
        : null
}

/** Replaces the original replay with the exact proposal approved by a person; malformed edits never run the original calls. */
export const approvedInputOf = (input: ApprovalInput, data: StepJson | undefined): ApprovalInput | null => {
    if (data === undefined) return input
    const parsed = approvedProposalSchema.safeParse(data)
    if (!parsed.success) return null
    const calls = approvedCallsOf(parsed.data.fields)
    return calls === null
        ? null
        : {
              ...input,
              calls: [...calls],
              scope: { ...input.scope, planned: parsed.data.draft ?? "" },
          }
}

/** The outputs of an approved item: its calls in order, each under the replay key of the item, the first carrying the rest. */
export const approvedOutputsOf = (input: ApprovalInput, approvedBy: string): ReadonlyArray<StepSpec> => {
    const { workItemId, calls, scope } = input
    const [first, ...rest] = calls.map((call, index) => {
        const place = calls.length === 1 ? "" : `${String(index)}:`
        return {
            ...call,
            stepKey: `output:${workItemId}:${String(index)}:${call.tool}`,
            opKey: `${workItemId}:${place}${call.tool}`,
        }
    })
    return first === undefined ? [] : [outputSpecOf(first, rest, { ...scope, workItemId, approvedBy })]
}

/** What a person's no owes: nothing runs, and the same reply step answers under the work item with the neutral line. */
export const declinedReplyOf = (input: ApprovalInput): StepSpec =>
    finalReplySpecOf({ ...input.scope, workItemId: input.workItemId, planned: "", declined: true })

/** The step that answers the customer: it reads the results of the outputs from the run and needs nothing else. */
export const finalReplySpecOf = (scope: OutputScope): StepSpec => ({
    stepKey: scope.workItemId === null ? FINAL_REPLY_KEY : `${FINAL_REPLY_KEY}:${scope.workItemId}`,
    nodeKey: scope.replyNode,
    kind: FINAL_REPLY_STEP_KIND,
    effect: { kind: "pivot" },
    input: { ...scope },
})

/** The result a call leaves on its step. */
export const outputResultOf = (output: AuthorityOutputStep, scope: OutputScope): StepJson => ({ ...output, scope })

const storedOf = (result: StepJson): ReadonlyArray<StoredOutput> => {
    const parsed = outputStepSchema.safeParse(result)
    return parsed.success ? [parsed.data] : []
}

/** The output a replay of a step answers, or null when the row holds something else. */
export const outputStepFrom = (result: StepJson): AuthorityOutputStep | null => storedOf(result)[0] ?? null

const storedOutputs = (
    earlier: Readonly<Record<string, StepJson>>,
    workItemId: string | null,
): ReadonlyArray<StoredOutput> =>
    Object.entries(earlier)
        .filter(([key]) => key.startsWith(OUTPUT_KEY_PREFIX))
        .flatMap(([, result]) => storedOf(result))
        .filter(
            (step) =>
                step.status !== "held" &&
                (workItemId !== null || !NO_SUCH_TOOL.has(step.code ?? "")) &&
                step.scope.workItemId === workItemId,
        )

/** What the outputs of a turn or of one approved item came to, in the order they ran; a call a person still holds has come to nothing yet. */
export const outputsOf = (
    earlier: Readonly<Record<string, StepJson>>,
    workItemId: string | null,
): ReadonlyArray<AuthorityOutputStep> => storedOutputs(earlier, workItemId)

/** The final reply a run owes: its step when an output came to something, so the model's own text does not leave; null otherwise. */
export const finalReplyOwed = (earlier: Readonly<Record<string, StepJson>>): StepSpec | null => {
    const [first] = storedOutputs(earlier, null)
    return first === undefined ? null : finalReplySpecOf(first.scope)
}
