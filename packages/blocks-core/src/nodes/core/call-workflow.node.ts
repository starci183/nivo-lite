import { CALL_WORKFLOW_STEP, WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER, callTargetSchema } from "@nivo-lite/agent-sdk/graph"
import type { CallTarget, CallVersion } from "@nivo-lite/agent-sdk/graph"
import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { EffectPayload, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"

/** What an end hand-off passes: the target's inputs by name, each already read from its ref or written as a fixed value. */
export interface CallWorkflowInput {
    readonly inputs: Readonly<Record<string, unknown>>
}

/** What it answers: the workflow it called and the wake the tag wrote. */
export interface CallWorkflowOutput {
    readonly agent: string
    readonly workflow: string
    readonly version: CallVersion
    readonly tag: { readonly kind: string; readonly id: string }
}

const TEXT_MAX = 2000

/** The member of the tag context that names the run that called; the target's engine adds the caller's agent and workflow. */
export const CALLER_MEMBER = "caller"

const params: NodeSchema<CallTarget> = callTargetSchema
const input: NodeSchema<CallWorkflowInput> = z.object({ inputs: boundedRecord })
const output: NodeSchema<CallWorkflowOutput> = z.object({
    agent: z.string().max(MAX_ID),
    workflow: z.string().max(MAX_ID),
    version: z.union([z.number().int().positive(), z.literal("latest")]),
    tag: z.object({ kind: z.string().max(MAX_ID), id: z.string().max(MAX_ID) }),
})

/** A string member of the passed inputs, or undefined. */
const textOf = (inputs: Readonly<Record<string, unknown>>, name: string): string | undefined => {
    const value = inputs[name]
    return typeof value === "string" && value !== "" ? value : undefined
}

/**
 * The `agent.tag` payload of a hand-off: the agent of the target's module, the pin of the workflow and version routing honours, and
 * ONLY the mapped inputs as the data the target's trigger reads (`trigger.<name>`). The lead and the conversation ride along when the
 * target declares them, so the target speaks in the same chat and reads the same lead memory; the calling run is named so the target
 * sees `trigger.caller`. The line shown is the customer's words when
 * the hand-off passes them, else a neutral note.
 */
export const callPayloadOf = (
    target: CallTarget,
    inputs: Readonly<Record<string, unknown>>,
    callerRunId: string,
): EffectPayload => {
    const leadId = textOf(inputs, "leadId")
    const conversationId = textOf(inputs, "conversationId")
    const channel = textOf(inputs, "channel")
    return {
        toModuleKey: target.agent,
        visibility: "chat",
        text: (textOf(inputs, "text") ?? messageOf("vi", "nodeCoreCallWorkflowNote")).slice(0, TEXT_MAX),
        context: {
            [WORKFLOW_CALL_MEMBER]: { workflow: target.workflow, version: target.version },
            [WORKFLOW_PARAMS_MEMBER]: { ...inputs },
            [CALLER_MEMBER]: { runId: callerRunId },
        },
        ...(leadId === undefined ? {} : { leadId }),
        ...(conversationId === undefined ? {} : { conversationId }),
        ...(channel === undefined ? {} : { channel }),
    }
}

/**
 * `core.call-workflow`: the end hand-off of a workflow. It names the target exactly (the agent by its module, the workflow by key, a
 * version or `latest`) and passes only the inputs the graph maps; the save checks that they cover the target's input contract with
 * matching types. One tag per run and target, so a step tried again wakes the target once.
 */
export const coreCallWorkflowNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: CALL_WORKFLOW_STEP,
    role: "output",
    title: bilingualOf("nodeCoreCallWorkflowTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["agent.tag"],
    run: async (given, context) => {
        const target = context.params
        const tag = await context.effect("agent.tag", callPayloadOf(target, given.inputs, context.turn.turnId), {
            dedupeKey: `call-workflow:${context.turn.turnId}:${target.agent}.${target.workflow}`,
        })
        return { agent: target.agent, workflow: target.workflow, version: target.version, tag }
    },
    examples: [
        {
            name: "calls the sales consult with only the mapped inputs, pinned to the workflow",
            params: { agent: "sales", workflow: "consult", version: "latest" },
            input: { inputs: { leadId: "l1", conversationId: "c1", text: "Em muốn đặt 1 chậu hoa" } },
            output: { agent: "sales", workflow: "consult", version: "latest", tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "sales",
                        visibility: "chat",
                        text: "Em muốn đặt 1 chậu hoa",
                        context: {
                            workflowCall: { workflow: "consult", version: "latest" },
                            params: { leadId: "l1", conversationId: "c1", text: "Em muốn đặt 1 chậu hoa" },
                            caller: { runId: "turn-1" },
                        },
                        leadId: "l1",
                        conversationId: "c1",
                    },
                },
            ],
        },
        {
            name: "a hand-off with no words shows the neutral note and keeps a pinned version",
            params: { agent: "sales", workflow: "after-sale", version: 3 },
            input: { inputs: { orderId: "o1" } },
            output: { agent: "sales", workflow: "after-sale", version: 3, tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "sales",
                        visibility: "chat",
                        text: "Chuyển tiếp sang quy trình tiếp theo",
                        context: {
                            workflowCall: { workflow: "after-sale", version: 3 },
                            params: { orderId: "o1" },
                            caller: { runId: "turn-1" },
                        },
                    },
                },
            ],
        },
    ],
})
